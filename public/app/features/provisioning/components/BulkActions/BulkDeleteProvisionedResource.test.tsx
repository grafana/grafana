import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { createJob, createRepository } from '../../mocks/factories';
import { setupProvisioningMswServer } from '../../mocks/server';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';

setupProvisioningMswServer();

jest.mock('app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents', () => ({
  AffectedFolderContents: jest.fn(({ selectedItems, defaultMessage }) => (
    <div data-testid="affected-folder-contents">
      {defaultMessage}
      Mocked affected folder contents for {Object.keys(selectedItems.folder).length} folders and{' '}
      {Object.keys(selectedItems.dashboard).length} dashboards
    </div>
  )),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('app/features/provisioning/hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('../../hooks/useSelectionRepoValidation', () => ({
  useSelectionRepoValidation: jest.fn(),
}));

const mockUseSelectionRepoValidation = useSelectionRepoValidation as jest.MockedFunction<
  typeof useSelectionRepoValidation
>;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: jest.fn(),
  })),
}));

const mockUseGetResourceRepositoryView = jest.mocked(
  require('app/features/provisioning/hooks/useGetResourceRepositoryView').useGetResourceRepositoryView
);
const mockGetAppEvents = jest.mocked(require('@grafana/runtime').getAppEvents);

type DeleteJobBody = {
  message?: string;
  delete?: { ref?: string; resources?: Array<{ name: string; group: string; kind: string }> };
};

const successJob = () => createJob({ spec: { action: 'delete' }, status: { state: 'success' } });
const workingJob = () =>
  createJob({ spec: { action: 'delete' }, status: { state: 'working', message: 'Deleting...' } });

/** Captures the posted delete job and answers the job watch with `job`. */
function mockDeleteJob(job: Job = successJob()) {
  const posted: { repository?: string; body?: DeleteJobBody } = {};
  server.use(
    http.post(`${BASE}/repositories/:name/jobs`, async ({ request, params }) => {
      posted.repository = String(params.name);
      posted.body = (await request.json()) as DeleteJobBody;
      return HttpResponse.json(job);
    }),
    http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [job], metadata: { resourceVersion: '1' } })),
    // The finished job links back to its repository
    http.get(`${BASE}/repositories/:name`, ({ params }) =>
      HttpResponse.json(createRepository({ metadata: { name: String(params.name) } }))
    )
  );
  return posted;
}

function setup(repository: RepositoryView | null, job: Job = successJob()) {
  const selectedItems = {
    folder: { 'folder-1': true },
    dashboard: { 'dashboard-1': true },
  };

  const defaultRepository: RepositoryView = {
    name: 'test-folder',
    type: 'github',
    title: 'Test Repository',
    target: 'folder',
    workflows: ['branch', 'write'],
  };

  const onDismiss = jest.fn();
  const onJobCreated = jest.fn();
  const posted = mockDeleteJob(job);

  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: repository ?? defaultRepository,
    folder: repository
      ? {
          metadata: {
            annotations: {
              'grafana.app/file-path': '/test/folder',
            },
          },
        }
      : null,
    isInstanceManaged: false,
    isMissingRepo: false,
  });

  const renderResult = render(
    <BulkDeleteProvisionedResource
      folderUid="test-folder"
      selectedItems={selectedItems}
      onDismiss={onDismiss}
      onJobCreated={onJobCreated}
    />
  );

  return {
    onDismiss,
    onJobCreated,
    posted,
    selectedItems,
    defaultRepository,
    ...renderResult,
  };
}

describe('BulkDeleteProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: 'test-folder',
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isItemInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the delete warning and form', async () => {
    setup(null);

    expect(await screen.findByText(/This will delete selected folders and their descendants/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('shows a spinner while repository data is loading', async () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: false,
      isLoading: true,
    });

    render(
      <BulkDeleteProvisionedResource
        folderUid="test-folder"
        selectedItems={{ folder: { 'folder-1': true }, dashboard: {} }}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });

  it('shows RepoInvalidStateBanner when repository is not found', async () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: true,
    });

    render(
      <BulkDeleteProvisionedResource
        folderUid="test-folder"
        selectedItems={{ folder: { 'folder-1': true }, dashboard: {} }}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByText(/Repository not found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('calls onDismiss when Cancel is clicked', async () => {
    const { onDismiss, user } = setup(null);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('posts the selected resources as a delete job and shows its outcome', async () => {
    const { user, posted, defaultRepository, onJobCreated } = setup(null);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    expect(posted.repository).toBe(defaultRepository.name);
    expect(posted.body).toEqual(
      expect.objectContaining({
        action: 'delete',
        message: expect.stringContaining('Delete resources'),
        delete: expect.objectContaining({
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      })
    );

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(onJobCreated).toHaveBeenCalledTimes(1);
  });

  it('handles deletion errors', async () => {
    const mockPublish = jest.fn();
    const { user, onJobCreated } = setup(null);
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, () =>
        HttpResponse.json({ message: 'Network error' }, { status: 500 })
      )
    );

    mockGetAppEvents.mockReturnValue({
      publish: mockPublish,
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'alert-error',
        payload: ['Error deleting resources', 'Network error'],
      });
    });
    // Should remain on form (not show JobStatus) when there's an error
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(onJobCreated).not.toHaveBeenCalled();
  });

  it('shows the job progress in place of the form while it runs', async () => {
    const { user } = setup(null, workingJob());

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(await screen.findByText('Deleting...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('calls createBulkJob with branch workflow parameters by default', async () => {
    const { user, posted } = setup(null);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    expect(posted.body).toEqual(
      expect.objectContaining({
        action: 'delete',
        delete: expect.objectContaining({
          ref: expect.stringContaining('bulk-delete/'),
        }),
      })
    );
  });

  it('preserves repository context when selection clears on root page', async () => {
    const selectedItems = {
      folder: { 'folder-1': true },
      dashboard: { 'dashboard-1': true },
    };

    const defaultRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['branch', 'write'],
    };

    mockDeleteJob();

    mockUseGetResourceRepositoryView.mockImplementation(({ folderName }: { folderName?: string }) => {
      if (folderName === 'test-folder') {
        return {
          repository: defaultRepository,
          folder: null,
          isInstanceManaged: false,
          isReadOnlyRepo: false,
          isMissingRepo: false,
        };
      }
      return {
        repository: undefined,
        folder: null,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        isMissingRepo: true,
      };
    });

    const onDismiss = jest.fn();
    const { rerender, user } = render(
      <BulkDeleteProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    await user.click(screen.getByRole('button', { name: /Delete/i }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    // Simulate selection clearing after job starts
    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: undefined,
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isItemInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });

    rerender(
      <BulkDeleteProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    // The ref should preserve the repo UID, so the job status remains visible
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });

  it('calls createBulkJob with write workflow parameters for write-only repositories', async () => {
    const writeOnlyRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['write'],
    };
    const { user, posted } = setup(writeOnlyRepository);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    // A direct write targets the configured branch, so the request carries no ref
    expect(posted.body!.delete).not.toHaveProperty('ref');
    expect(posted.body!.delete?.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
        expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
      ])
    );
  });

  it('does not show a generated branch and targets the configured branch when write is the default workflow', async () => {
    const writeFirstRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      branch: 'main',
      workflows: ['write', 'branch'],
    };
    const { user, posted } = setup(writeFirstRepository);

    // Wait for the real ResourceEditFormSharedFields branch field to render.
    await screen.findByRole('button', { name: /Delete/i });

    // The pre-filled branch must match the job (configured branch), not a generated bulk-delete branch.
    expect(screen.queryByText(/bulk-delete\//)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/bulk-delete\//)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    expect(posted.body!.delete).not.toHaveProperty('ref');
  });

  it('shows the branch success message when the job completes on the branch workflow', async () => {
    // Default repo has workflows ['branch', 'write'], so the default workflow is 'branch'.
    const { user } = setup(null);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(await screen.findByText('Requested changes were pushed to a branch')).toBeInTheDocument();
  });

  it('shows the configured-branch success message when the job completes on the write workflow', async () => {
    const writeOnlyRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['write'],
    };
    const { user } = setup(writeOnlyRepository);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(await screen.findByText('Resources deleted successfully')).toBeInTheDocument();
  });

  describe('commit message template', () => {
    // selectedItems in setup() has one folder + one dashboard => "2 resources".
    const templateRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['branch', 'write'],
      commit: { singleResourceMessageTemplate: 'chore: {{action}} {{title}}' },
    };

    it('pre-fills the comment from the rendered template and POSTs it', async () => {
      const { user, posted } = setup(templateRepository);

      const textarea = await screen.findByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: delete 2 resources'));

      await user.click(screen.getByRole('button', { name: /Delete/i }));

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.body).toEqual(expect.objectContaining({ action: 'delete', message: 'chore: delete 2 resources' }));
    });

    it('renders the comment read-only when the template is enforced', async () => {
      const enforcedRepository: RepositoryView = {
        ...templateRepository,
        commit: { singleResourceMessageTemplate: 'chore: {{action}} {{title}}', enforceTemplate: true },
      };
      const { posted } = setup(enforcedRepository);

      const textarea = await screen.findByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: delete 2 resources'));
      expect(textarea).toHaveAttribute('readonly');

      expect(posted.body).toBeUndefined();
    });

    it('keeps a manual edit across re-renders and POSTs the edited message', async () => {
      const { user, posted, selectedItems, onDismiss, rerender } = setup(templateRepository);

      const textarea = await screen.findByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: delete 2 resources'));

      await user.type(textarea, ' edited');
      expect(textarea).toHaveValue('chore: delete 2 resources edited');

      // A re-render must not clobber the user's edit with the template.
      rerender(
        <BulkDeleteProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
      );
      expect(textarea).toHaveValue('chore: delete 2 resources edited');

      await user.click(screen.getByRole('button', { name: /Delete/i }));

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.body).toEqual(expect.objectContaining({ message: 'chore: delete 2 resources edited' }));
    });
  });
});
