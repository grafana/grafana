import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';

import { setupProvisioningMswServer } from '../../mocks/server';

import { FixFolderMetadataDrawer } from './FixFolderMetadataDrawer';

const server = setupProvisioningMswServer();

const REPO_NAME = 'test-repo';

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

function setup(jsx: JSX.Element) {
  return { ...render(jsx), user: userEvent.setup() };
}

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

  it('renders branch and comment fields', async () => {
    setup(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    // Wait for the drawer to load the repository and render the form
    expect(await screen.findByRole('button', { name: /fix folder ids/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/comment/i)).toBeInTheDocument();
  });

  it('renders cancel and submit buttons', async () => {
    setup(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fix folder ids/i })).toBeInTheDocument();
  });

  it('calls onDismiss when cancel is clicked', async () => {
    const onDismiss = jest.fn();
    const { user } = setup(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={onDismiss} />);

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('submits job with ref from form', async () => {
    let capturedBody: unknown;
    const jobResponse = {
      metadata: { name: 'job-1', uid: 'job-uid-1', labels: { 'provisioning.grafana.app/repository': REPO_NAME } },
      spec: { action: 'fixFolderMetadata' },
      status: { state: 'success' },
    };
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(jobResponse);
      }),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [jobResponse] }))
    );

    const { user } = setup(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    await screen.findByRole('button', { name: /fix folder ids/i });

    await user.click(screen.getByRole('button', { name: /fix folder ids/i }));

    expect(capturedBody).toEqual(
      expect.objectContaining({
        action: 'fixFolderMetadata',
        fixFolderMetadata: expect.objectContaining({
          ref: 'main',
        }),
      })
    );
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

    setup(<FixFolderMetadataDrawer repositoryName={REPO_NAME} onDismiss={jest.fn()} />);

    expect(await screen.findByText(/This repository is read only/i)).toBeInTheDocument();
  });
});
