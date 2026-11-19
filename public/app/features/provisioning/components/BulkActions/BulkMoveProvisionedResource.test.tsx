import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { fullyLoadedViewItemCollection } from 'app/features/browse-dashboards/fixtures/state.fixtures';
import { type BrowseDashboardsState } from 'app/features/browse-dashboards/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { createJob, createRepository } from '../../mocks/factories';
import { setupProvisioningMswServer } from '../../mocks/server';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';

import { BulkMoveProvisionedResource } from './BulkMoveProvisionedResource';

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

jest.mock('app/api/clients/folder/v1beta1', () => ({
  useGetFolderQuery: jest.fn().mockReturnValue({ data: undefined, isLoading: false }),
}));

jest.mock('../Shared/ProvisioningAwareFolderPicker', () => ({
  ProvisioningAwareFolderPicker: jest.fn(({ onChange, value }) => (
    <button type="button" data-testid="folder-picker" onClick={() => onChange('target-folder-uid')}>
      {value || 'Select folder'}
    </button>
  )),
}));

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
const mockUseGetFolderQuery = jest.mocked(require('app/api/clients/folder/v1beta1').useGetFolderQuery);
const mockFolderPicker = jest.mocked(ProvisioningAwareFolderPicker);

// jest.clearAllMocks() clears call history but not a custom mockImplementation, so a per-test
// override that picks a different target would leak; restore the default in beforeEach.
function resetFolderPickerMock(targetUID = 'target-folder-uid') {
  mockFolderPicker.mockImplementation(({ onChange, value }) => (
    <button type="button" data-testid="folder-picker" onClick={() => onChange?.(targetUID, undefined)}>
      {value || 'Select folder'}
    </button>
  ));
}

function browseDashboardsState(
  rootItems: DashboardViewItem[],
  childrenByParentUID: BrowseDashboardsState['childrenByParentUID']
): BrowseDashboardsState {
  return {
    rootItems: fullyLoadedViewItemCollection(rootItems),
    childrenByParentUID,
    openFolders: {},
    selectedItems: { $all: false, folder: {}, dashboard: {}, panel: {} },
  };
}

type MoveJobBody = {
  message?: string;
  move?: { ref?: string; targetPath?: string; resources?: Array<{ name: string; group: string; kind: string }> };
};

const successJob = () => createJob({ spec: { action: 'move' }, status: { state: 'success' } });
const workingJob = () => createJob({ spec: { action: 'move' }, status: { state: 'working', message: 'Moving...' } });

/** Captures the posted move job and answers the job watch with `job`. */
function mockMoveJob(job: Job = successJob()) {
  const posted: { repository?: string; body?: MoveJobBody } = {};
  server.use(
    http.post(`${BASE}/repositories/:name/jobs`, async ({ request, params }) => {
      posted.repository = String(params.name);
      posted.body = (await request.json()) as MoveJobBody;
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
  const posted = mockMoveJob(job);

  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: repository ?? defaultRepository,
    folder: repository
      ? {
          metadata: {
            annotations: {
              [AnnoKeySourcePath]: '/test/folder',
            },
          },
        }
      : null,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
  });

  const renderResult = render(
    <BulkMoveProvisionedResource
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

describe('BulkMoveProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFolderPickerMock();

    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: 'test-folder',
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isItemInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });

    mockUseGetFolderQuery.mockReturnValue({
      data: {
        metadata: {
          name: 'target-folder-uid',
          annotations: {
            [AnnoKeySourcePath]: 'target-path',
          },
        },
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the move warning, form elements, and buttons', async () => {
    setup(null);

    expect(await screen.findByText(/This will move selected folders and their descendants/)).toBeInTheDocument();
    expect(screen.getByTestId('affected-folder-contents')).toBeInTheDocument();
    expect(screen.getByTestId('folder-picker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('disables Move button when no target folder is selected', async () => {
    setup(null);

    const moveButton = await screen.findByRole('button', { name: /Move/i });
    expect(moveButton).toBeDisabled();
  });

  it('calls onDismiss when Cancel is clicked', async () => {
    const { onDismiss, user } = setup(null);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('posts the selected resources as a move job and shows its outcome', async () => {
    const { user, posted, defaultRepository, onJobCreated } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    expect(posted.repository).toBe(defaultRepository.name);
    expect(posted.body).toEqual(
      expect.objectContaining({
        action: 'move',
        message: expect.stringContaining('Move resources'),
        move: expect.objectContaining({
          targetPath: expect.any(String),
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

  it('handles move errors', async () => {
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

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'alert-error',
        payload: ['Error moving resources', 'Network error'],
      });
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move/i })).toBeInTheDocument();
    expect(onJobCreated).not.toHaveBeenCalled();
  });

  it('shows the job progress in place of the form while it runs', async () => {
    const { user } = setup(null, workingJob());

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(await screen.findByText('Moving...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Move/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it('calls createBulkJob with branch workflow parameters by default', async () => {
    const { user, posted } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    expect(posted.body!.move?.ref).toEqual(expect.stringContaining('bulk-move/'));
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

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    // A direct write targets the configured branch, so the request carries no ref
    expect(posted.body!.move).not.toHaveProperty('ref');
    expect(posted.body!.move?.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
        expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
      ])
    );
  });

  it('shows error when every selected item is already in the target folder', async () => {
    const repository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['branch', 'write'],
    };
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: false,
    });

    const posted = mockMoveJob();

    // Both selected items live directly under the folder the picker returns ('target-folder-uid').
    const repoRoot: DashboardViewItem = { kind: 'folder', uid: 'test-folder', title: 'Repo root' };
    const targetFolder: DashboardViewItem = {
      kind: 'folder',
      uid: 'target-folder-uid',
      title: 'Target',
      parentUID: 'test-folder',
    };
    const folder1: DashboardViewItem = {
      kind: 'folder',
      uid: 'folder-1',
      title: 'Folder 1',
      parentUID: 'target-folder-uid',
    };
    const dashboard1: DashboardViewItem = {
      kind: 'dashboard',
      uid: 'dashboard-1',
      title: 'Dashboard 1',
      parentUID: 'target-folder-uid',
    };

    const selectedItems = {
      folder: { 'folder-1': true },
      dashboard: { 'dashboard-1': true },
    };

    const { user } = render(
      <BulkMoveProvisionedResource folderUid="target-folder-uid" selectedItems={selectedItems} onDismiss={jest.fn()} />,
      {
        preloadedState: {
          browseDashboards: browseDashboardsState([repoRoot], {
            'test-folder': fullyLoadedViewItemCollection([targetFolder]),
            'target-folder-uid': fullyLoadedViewItemCollection([folder1, dashboard1]),
          }),
        },
      }
    );

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(await screen.findByText(/Selected resources are already in the target folder/)).toBeInTheDocument();
    expect(posted.body).toBeUndefined();
  });

  it('moves a nested folder to the repository root from the root browse page', async () => {
    const repository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['branch', 'write'],
    };
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: false,
    });

    const posted = mockMoveJob();

    // Picking the repo root folder: its k8s name equals the repository name, which resolves to the '/' path.
    resetFolderPickerMock('test-folder');
    mockUseGetFolderQuery.mockReturnValue({
      data: { metadata: { name: 'test-folder' } },
      isLoading: false,
    });

    // Tree: repo root 'test-folder' > 'parent-folder' > 'nested-folder'; the user expanded it on the root page.
    const repoRoot: DashboardViewItem = { kind: 'folder', uid: 'test-folder', title: 'Repo root' };
    const parentFolder: DashboardViewItem = {
      kind: 'folder',
      uid: 'parent-folder',
      title: 'Parent',
      parentUID: 'test-folder',
    };
    const nestedFolder: DashboardViewItem = {
      kind: 'folder',
      uid: 'nested-folder',
      title: 'Nested',
      parentUID: 'parent-folder',
    };

    const selectedItems = { folder: { 'nested-folder': true }, dashboard: {} };

    const { user } = render(
      <BulkMoveProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={jest.fn()} />,
      {
        preloadedState: {
          browseDashboards: browseDashboardsState([repoRoot], {
            'test-folder': fullyLoadedViewItemCollection([parentFolder]),
            'parent-folder': fullyLoadedViewItemCollection([nestedFolder]),
          }),
        },
      }
    );

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => expect(posted.body).toBeDefined());
    expect(posted.repository).toBe(repository.name);
    expect(posted.body).toEqual(
      expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          targetPath: '/',
          resources: [expect.objectContaining({ name: 'nested-folder', kind: 'Folder' })],
        }),
      })
    );
    expect(screen.queryByText(/Selected resources are already in the target folder/)).not.toBeInTheDocument();
  });

  it('shows RepoInvalidStateBanner when repository is not found', () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: true,
    });

    const selectedItems = {
      folder: { 'folder-1': true },
      dashboard: { 'dashboard-1': true },
    };

    render(<BulkMoveProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={jest.fn()} />);

    expect(screen.getByText(/Repository not found/)).toBeInTheDocument();
  });

  it('shows RepoInvalidStateBanner when repository is read-only', () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: {
        name: 'test-folder',
        type: 'github',
        title: 'Test Repository',
        target: 'folder',
        workflows: ['branch', 'write'],
      },
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: true,
      isMissingRepo: false,
    });

    const selectedItems = {
      folder: { 'folder-1': true },
      dashboard: { 'dashboard-1': true },
    };

    render(<BulkMoveProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={jest.fn()} />);

    expect(screen.getByText(/This repository is read only/)).toBeInTheDocument();
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

    mockMoveJob();

    const onDismiss = jest.fn();
    const { rerender, user } = render(
      <BulkMoveProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: undefined,
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isItemInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });

    rerender(<BulkMoveProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });

  it('shows the branch success message when the job completes on the branch workflow', async () => {
    // Default repo has workflows ['branch', 'write'], so the default workflow is 'branch'.
    const { user } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

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

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(await screen.findByText('Resources moved successfully')).toBeInTheDocument();
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
      await waitFor(() => expect(textarea).toHaveValue('chore: move 2 resources'));

      await user.click(screen.getByTestId('folder-picker'));
      await user.click(screen.getByRole('button', { name: /Move/i }));

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.body).toEqual(expect.objectContaining({ action: 'move', message: 'chore: move 2 resources' }));
    });

    it('renders the comment read-only when the template is enforced', async () => {
      const enforcedRepository: RepositoryView = {
        ...templateRepository,
        commit: { singleResourceMessageTemplate: 'chore: {{action}} {{title}}', enforceTemplate: true },
      };
      setup(enforcedRepository);

      const textarea = await screen.findByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: move 2 resources'));
      expect(textarea).toHaveAttribute('readonly');
    });

    it('keeps a manual edit across re-renders and POSTs the edited message', async () => {
      const { user, posted, selectedItems, onDismiss, rerender } = setup(templateRepository);

      const textarea = await screen.findByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: move 2 resources'));

      await user.type(textarea, ' edited');
      expect(textarea).toHaveValue('chore: move 2 resources edited');

      // A re-render must not clobber the user's edit with the template.
      rerender(
        <BulkMoveProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
      );
      expect(textarea).toHaveValue('chore: move 2 resources edited');

      await user.click(screen.getByTestId('folder-picker'));
      await user.click(screen.getByRole('button', { name: /Move/i }));

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.body).toEqual(expect.objectContaining({ message: 'chore: move 2 resources edited' }));
    });
  });
});
