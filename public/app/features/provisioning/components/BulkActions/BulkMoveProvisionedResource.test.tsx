import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';

import { BulkMoveProvisionedResource } from './BulkMoveProvisionedResource';
import { type ResponseType } from './useBulkActionJob';

jest.mock('app/features/browse-dashboards/components/BrowseActions/DescendantCount', () => ({
  DescendantCount: jest.fn(({ selectedItems }) => (
    <div data-testid="descendant-count">
      Mocked descendant count for {Object.keys(selectedItems.folder).length} folders and{' '}
      {Object.keys(selectedItems.dashboard).length} dashboards
    </div>
  )),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('../../hooks/useSelectionRepoValidation', () => ({
  useSelectionRepoValidation: jest.fn(),
}));

const mockUseSelectionRepoValidation = useSelectionRepoValidation as jest.MockedFunction<
  typeof useSelectionRepoValidation
>;

jest.mock('./useBulkActionJob', () => ({
  useBulkActionJob: jest.fn(),
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

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="resource-edit-form" />,
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
const mockUseBulkActionJob = jest.mocked(require('./useBulkActionJob').useBulkActionJob);
const mockGetAppEvents = jest.mocked(require('@grafana/runtime').getAppEvents);
const mockUseGetFolderQuery = jest.mocked(require('app/api/clients/folder/v1beta1').useGetFolderQuery);

function setup(
  repository: RepositoryView | null,
  mockJobResult: ResponseType = {
    success: true,
    job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
  },
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
  const mockCreateBulkJob = jest.fn().mockResolvedValue(mockJobResult);

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
  });

  mockUseBulkActionJob.mockReturnValue({
    createBulkJob: mockCreateBulkJob,
    isLoading,
  });

  const renderResult = render(
    <BulkMoveProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
  );

  return {
    onDismiss,
    mockCreateBulkJob,
    selectedItems,
    defaultRepository,
    ...renderResult,
  };
}

describe('BulkMoveProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: 'test-folder',
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isUidInReadOnlyRepo: jest.fn().mockReturnValue(false),
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
    expect(screen.getByText(/In total, this will affect:/)).toBeInTheDocument();
    expect(screen.getByTestId('descendant-count')).toBeInTheDocument();
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
    const { user, mockCreateBulkJob, defaultRepository } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      defaultRepository,
      expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          targetPath: expect.any(String),
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      })
    );

    expect(await screen.findByTestId('job-status')).toBeInTheDocument();
    expect(screen.getByText(/Job Status - move - success/)).toBeInTheDocument();
  });

  it('handles move errors', async () => {
    const mockPublish = jest.fn();
    const { user } = setup(null, { success: false, error: 'Network error' });

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
    const { user } = setup(null, { success: true, job: workingJob });

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    await waitFor(() => {
      expect(screen.getByTestId('job-status')).toBeInTheDocument();
    });

    expect(screen.getByText(/Job Status - move - working/)).toBeInTheDocument();
  });

  it('hides form buttons when job is in working state', async () => {
    const workingJob: Job = { metadata: { name: 'test-job' }, status: { state: 'working' } };
    const { user } = setup(null, { success: true, job: workingJob });

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(await screen.findByTestId('job-status')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Move/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it('calls createBulkJob with branch workflow parameters by default', async () => {
    const { user, mockCreateBulkJob } = setup(null);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          ref: expect.stringContaining('bulk-move/'),
        }),
      })
    );
  });

  it('calls createBulkJob with write workflow parameters for write-only repositories', async () => {
    const writeOnlyRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['write'],
    };
    const { user, mockCreateBulkJob } = setup(writeOnlyRepository);

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      writeOnlyRepository,
      expect.objectContaining({
        action: 'move',
        move: expect.objectContaining({
          ref: undefined,
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      })
    );
  });

  it('shows error when target folder path is the same as source', async () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: {
        name: 'test-folder',
        type: 'github',
        title: 'Test Repository',
        target: 'folder',
        workflows: ['branch', 'write'],
      },
      folder: {
        metadata: {
          annotations: {
            [AnnoKeySourcePath]: 'target-path',
          },
        },
      },
      isInstanceManaged: false,
      isReadOnlyRepo: false,
    });

    const mockCreateBulkJob = jest.fn().mockResolvedValue({
      success: true,
      job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: mockCreateBulkJob,
      isLoading: false,
    });

    const selectedItems = {
      folder: { 'folder-1': true },
      dashboard: { 'dashboard-1': true },
    };

    const { user } = render(
      <BulkMoveProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={jest.fn()} />
    );

    await user.click(screen.getByTestId('folder-picker'));
    await user.click(screen.getByRole('button', { name: /Move/i }));

    expect(mockCreateBulkJob).not.toHaveBeenCalled();
    expect(await screen.findByText(/Selected resources are already in the target folder/)).toBeInTheDocument();
  });

  it('shows RepoInvalidStateBanner when repository is not found', () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: jest.fn(),
      isLoading: false,
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
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: jest.fn(),
      isLoading: false,
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

    const mockCreateBulkJob = jest.fn().mockResolvedValue({
      success: true,
      job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
    });

    mockUseGetResourceRepositoryView.mockImplementation(({ folderName }: { folderName?: string }) => {
      if (folderName === 'test-folder') {
        return {
          repository: defaultRepository,
          folder: null,
          isInstanceManaged: false,
          isReadOnlyRepo: false,
        };
      }
      return {
        repository: undefined,
        folder: null,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      };
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: mockCreateBulkJob,
      isLoading: false,
    });

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
      isUidInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });

    rerender(<BulkMoveProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />);

    expect(screen.getByTestId('job-status')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });
});
