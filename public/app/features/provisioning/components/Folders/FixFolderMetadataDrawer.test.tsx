import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';

import { setupProvisioningMswServer } from '../../mocks/server';

import { FixFolderMetadataDrawer } from './FixFolderMetadataDrawer';

const server = setupProvisioningMswServer();

const REPO_NAME = 'test-repo';

const jobResponse = {
  metadata: { name: 'job-1', uid: 'job-uid-1', labels: { 'provisioning.grafana.app/repository': REPO_NAME } },
  spec: { action: 'fixFolderMetadata' },
  status: { state: 'success' },
};

const defaultSettings = {
  items: [
    {
      name: REPO_NAME,
      branch: 'main',
      type: 'github',
      target: 'instance',
      workflows: ['write', 'branch'],
    },
  ],
  allowImageRendering: true,
  availableRepositoryTypes: ['github'],
};

describe('FixFolderMetadataDrawer', () => {
  testWithFeatureToggles({ enable: ['provisioning'] });

  beforeEach(() => {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(defaultSettings)),
      http.get(`${BASE}/repositories/:name`, () =>
        HttpResponse.json({ spec: { type: 'github' }, metadata: { name: REPO_NAME } })
      ),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [] }))
    );
  });

  it('renders branch field but not comment field', async () => {
    render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    // Wait for the drawer to load the repository and render the form
    expect(await screen.findByRole('button', { name: /fix folder ids/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/comment/i)).not.toBeInTheDocument();
  });

  it('renders cancel and submit buttons', async () => {
    render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fix folder ids/i })).toBeInTheDocument();
  });

  it('calls onDismiss when cancel is clicked', async () => {
    const onDismiss = jest.fn();
    const { user } = render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={onDismiss} />);

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('submits job with ref from form', async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(jobResponse);
      }),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [jobResponse] }))
    );

    const { user } = render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: /fix folder ids/i }));

    await waitFor(() => {
      expect(capturedBody).toEqual(
        expect.objectContaining({
          action: 'fixFolderMetadata',
          fixFolderMetadata: expect.objectContaining({
            ref: 'main',
          }),
        })
      );
    });
  });

  it('defaults to a generated branch name when write workflow is not available', async () => {
    server.use(
      http.get(`${BASE}/settings`, () =>
        HttpResponse.json({
          ...defaultSettings,
          items: [{ ...defaultSettings.items[0], workflows: ['branch'] }],
        })
      )
    );

    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(jobResponse);
      }),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [jobResponse] }))
    );

    const { user } = render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: /fix folder ids/i }));

    await waitFor(() => {
      expect(capturedBody).toEqual(
        expect.objectContaining({
          action: 'fixFolderMetadata',
          fixFolderMetadata: expect.objectContaining({
            ref: expect.stringMatching(/^fix-folder-ids\//),
          }),
        })
      );
    });
  });

  it('submits job with custom branch', async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(jobResponse);
      }),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [jobResponse] }))
    );

    const { user } = render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    // Click opens the Combobox menu, whose stateReducer clears the input.
    // We must wait for that render before typing, otherwise the new text
    // appends to the previous value (e.g. "mainfeature-branch").
    const branchInput = await screen.findByRole('combobox', { name: /branch/i });
    await user.click(branchInput);
    await waitFor(() => expect(branchInput).toHaveValue(''));
    await user.keyboard('feature-branch{Enter}');

    await user.click(screen.getByRole('button', { name: /fix folder ids/i }));

    await waitFor(() => {
      expect(capturedBody).toEqual(
        expect.objectContaining({
          action: 'fixFolderMetadata',
          fixFolderMetadata: expect.objectContaining({
            ref: 'feature-branch',
          }),
        })
      );
    });
  });

  it('shows error alert when job submission fails', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, () =>
        HttpResponse.json({ message: 'server error' }, { status: 500 })
      )
    );

    const { user } = render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: /fix folder ids/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/error fixing folder metadata/i)).toBeInTheDocument();
  });

  it('does not close drawer on job success', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json(jobResponse)),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [jobResponse] }))
    );

    const onDismiss = jest.fn();
    const { user } = render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={onDismiss} />);

    await user.click(await screen.findByRole('button', { name: /fix folder ids/i }));

    // The drawer should remain open showing job status, not auto-dismiss
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows read-only banner for read-only repository', async () => {
    server.use(
      http.get(`${BASE}/settings`, () =>
        HttpResponse.json({
          items: [
            {
              name: REPO_NAME,
              branch: 'main',
              type: 'github',
              target: 'instance',
              workflows: [],
            },
          ],
          allowImageRendering: true,
          availableRepositoryTypes: ['github'],
        })
      )
    );

    render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    expect(await screen.findByText(/This repository is read only/i)).toBeInTheDocument();
  });

  it('disables submit when an active job exists', async () => {
    server.use(
      http.get(`${BASE}/jobs`, () =>
        HttpResponse.json({
          items: [
            {
              status: { state: 'working' },
              metadata: { labels: { 'provisioning.grafana.app/repository': REPO_NAME } },
            },
          ],
        })
      )
    );

    render(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fix folder ids/i })).toBeDisabled();
    });
  });
});
