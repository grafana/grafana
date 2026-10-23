import { screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { render } from 'test/test-utils';

import { type Job, type RepositoryView, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { fullyLoadedViewItemCollection } from 'app/features/browse-dashboards/fixtures/state.fixtures';
import { type BrowseDashboardsState } from 'app/features/browse-dashboards/types';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { type DashboardViewItem } from 'app/features/search/types';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';

import { BulkMoveProvisionedResource } from './BulkMoveProvisionedResource';

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

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useCreateRepositoryJobsMutation: jest.fn(),
}));

jest.mock('app/features/provisioning/Job/JobStatus', () => ({
  JobStatus: jest.fn(({ watch, jobType }) => (
    <div data-testid="job-status">
      Job Status - {jobType} - {watch?.status?.state || 'pending'}
    </div>
  )),
}));

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
const mockUseCreateRepositoryJobsMutation = jest.mocked(useCreateRepositoryJobsMutation);
const mockGetAppEvents = jest.mocked(require('@grafana/runtime').getAppEvents);
const mockUseGetFolderQuery = jest.mocked(require('app/api/clients/folder/v1beta1').useGetFolderQuery);
const mockJobStatus = jest.mocked(JobStatus);
const mockFolderPicker = jest.mocked(ProvisioningAwareFolderPicker);

// jest.clearAllMocks() clears call history but not a custom mockImplementation, so a per-test
// override of JobStatus would leak; restore the default in beforeEach.
function resetJobStatusMock() {
  mockJobStatus.mockImplementation(({ watch, jobType }) => (
    <div data-testid="job-status">
      Job Status - {jobType} - {watch?.status?.state || 'pending'}
    </div>
  ));
}

// Same leak concern as JobStatus: tests that pick a different target override this implementation.
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

/** Mocks the RTK mutation the forms create jobs with; `error` makes the request reject. */
function mockCreateJobMutation(result: { job?: Job; error?: unknown }, isLoading = false) {
  const mockCreateJob = jest.fn(() => ({
    unwrap: () => (result.error ? Promise.reject(result.error) : Promise.resolve(result.job)),
  }));
  mockUseCreateRepositoryJobsMutation.mockReturnValue([mockCreateJob, { isLoading }] as unknown as ReturnType<
    typeof useCreateRepositoryJobsMutation
  >);
  return mockCreateJob;
}

function setup(
  repository: RepositoryView | null,
  result: { job?: Job; error?: unknown } = { job: { metadata: { name: 'test-job' }, status: { state: 'success' } } },
  isLoading = false
) {
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
  const mockCreateJob = mockCreateJobMutation(result, isLoading);

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
    <BulkMoveProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
  );

  return {
    onDismiss,
    mockCreateJob,
    selectedItems,
    defaultRepository,
    ...renderResult,
  };
}

describe('BulkMoveProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJobStatusMock();
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

  it('handles successful move', async () => {
    const { user, mockCreateJob, defaultRepository } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateJob).toHaveBeenCalledWith({
      name: defaultRepository.name,
      jobSpec: expect.objectContaining({
        action: 'move',
        message: expect.stringContaining('Move resources'),
        move: expect.objectContaining({
          targetPath: expect.any(String),
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      }),
    });

    expect(await screen.findByTestId('job-status')).toBeInTheDocument();
    expect(screen.getByText(/Job Status - move - success/)).toBeInTheDocument();
  });

  it('handles move errors', async () => {
    const mockPublish = jest.fn();
    const { user } = setup(null, { error: 'Network error' });

    mockGetAppEvents.mockReturnValue({
      publish: mockPublish,
    });

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move/i })).toBeInTheDocument();

    expect(mockPublish).toHaveBeenCalledWith({
      type: 'alert-error',
      payload: ['Error moving resources', 'Network error'],
    });
  });

  it('shows JobStatus with working state during move', async () => {
    const workingJob: Job = { metadata: { name: 'test-job' }, status: { state: 'working' } };
    const { user } = setup(null, { job: workingJob });

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => {
      expect(screen.getByTestId('job-status')).toBeInTheDocument();
    });

    expect(screen.getByText(/Job Status - move - working/)).toBeInTheDocument();
  });

  it('hides form buttons when job is in working state', async () => {
    const workingJob: Job = { metadata: { name: 'test-job' }, status: { state: 'working' } };
    const { user } = setup(null, { job: workingJob });

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(await screen.findByTestId('job-status')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Move/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it('calls createBulkJob with branch workflow parameters by default', async () => {
    const { user, mockCreateJob } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateJob).toHaveBeenCalledWith({
      name: expect.anything(),
      jobSpec: expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          ref: expect.stringContaining('bulk-move/'),
        }),
      }),
    });
  });

  it('calls createBulkJob with write workflow parameters for write-only repositories', async () => {
    const writeOnlyRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['write'],
    };
    const { user, mockCreateJob } = setup(writeOnlyRepository);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateJob).toHaveBeenCalledWith({
      name: writeOnlyRepository.name,
      jobSpec: expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          ref: undefined,
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      }),
    });
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

    const mockCreateJob = mockCreateJobMutation({
      job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
    });

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
    expect(mockCreateJob).not.toHaveBeenCalled();
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

    const mockCreateJob = mockCreateJobMutation({
      job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
    });

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

    expect(mockCreateJob).toHaveBeenCalledWith({
      name: repository.name,
      jobSpec: expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          targetPath: '/',
          resources: [expect.objectContaining({ name: 'nested-folder', kind: 'Folder' })],
        }),
      }),
    });
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

    mockCreateJobMutation({});

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

    mockCreateJobMutation({});

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

    mockCreateJobMutation({ job: { metadata: { name: 'test-job' }, status: { state: 'success' } } });

    const onDismiss = jest.fn();
    const { rerender, user } = render(
      <BulkMoveProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));
    expect(await screen.findByTestId('job-status')).toBeInTheDocument();

    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: undefined,
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isItemInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });

    rerender(<BulkMoveProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />);

    expect(screen.getByTestId('job-status')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });

  it('shows the branch success message when the job completes on the branch workflow', async () => {
    mockJobStatus.mockImplementation(({ onStatusChange }) => {
      useEffect(() => {
        onStatusChange?.({ status: 'success' });
      }, [onStatusChange]);
      return <div data-testid="job-status" />;
    });

    // Default repo has workflows ['branch', 'write'], so the default workflow is 'branch'.
    const { user } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(await screen.findByText('Requested changes were pushed to a branch')).toBeInTheDocument();
  });

  it('shows the configured-branch success message when the job completes on the write workflow', async () => {
    mockJobStatus.mockImplementation(({ onStatusChange }) => {
      useEffect(() => {
        onStatusChange?.({ status: 'success' });
      }, [onStatusChange]);
      return <div data-testid="job-status" />;
    });

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
      const { user, mockCreateJob } = setup(templateRepository);

      const textarea = await screen.findByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: move 2 resources'));

      await user.click(screen.getByTestId('folder-picker'));
      await user.click(screen.getByRole('button', { name: /Move/i }));

      expect(mockCreateJob).toHaveBeenCalledWith({
        name: templateRepository.name,
        jobSpec: expect.objectContaining({ action: 'move', message: 'chore: move 2 resources' }),
      });
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
      const { user, mockCreateJob, selectedItems, onDismiss, rerender } = setup(templateRepository);

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

      expect(mockCreateJob).toHaveBeenCalledWith({
        name: templateRepository.name,
        jobSpec: expect.objectContaining({ message: 'chore: move 2 resources edited' }),
      });
    });
  });
});
