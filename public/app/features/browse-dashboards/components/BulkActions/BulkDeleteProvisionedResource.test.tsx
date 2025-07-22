import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';

jest.mock('app/api/clients/provisioning/v0alpha1', () => {
  const originalModule = jest.requireActual('app/api/clients/provisioning/v0alpha1');
  return {
    ...originalModule,
    useDeleteRepositoryFilesWithPathMutation: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('../utils', () => ({
  collectSelectedItems: jest.fn(),
  fetchProvisionedDashboardPath: jest.fn(),
}));

jest.mock('../../state/hooks', () => ({
  useChildrenByParentUIDState: jest.fn(),
  rootItemsSelector: jest.fn(),
}));

const mockDeleteMutation = jest.fn();
const mockUseDeleteRepositoryFilesWithPathMutation = jest.requireMock(
  'app/api/clients/provisioning/v0alpha1'
).useDeleteRepositoryFilesWithPathMutation;
const mockUseGetResourceRepositoryView = jest.requireMock(
  'app/features/provisioning/hooks/useGetResourceRepositoryView'
).useGetResourceRepositoryView;
const mockUtils = jest.requireMock('../utils');
const mockStateHooks = jest.requireMock('../../state/hooks');
const mockStateUtils = jest.requireMock('../../state/utils');

function setup(
  isLoading = false,
  repository: RepositoryView | null = {
    name: 'test-repo',
    type: 'github',
    title: 'Test Repository',
    target: 'folder',
    workflows: ['branch', 'write'],
  }
) {
  const selectedItems = {
    folder: { 'folder-1': true },
    dashboard: { 'dashboard-1': true },
  };

  const onDismiss = jest.fn();

  mockUseGetResourceRepositoryView.mockReturnValue({
    repository,
    folder: repository
      ? {
          metadata: {
            annotations: {
              'grafana.app/file-path': '/test/folder',
            },
          },
        }
      : null,
  });

  mockUtils.collectSelectedItems.mockReturnValue([
    { uid: 'folder-1', isFolder: true, displayName: 'Test Folder' },
    { uid: 'dashboard-1', isFolder: false, displayName: 'Test Dashboard' },
  ]);

  mockUtils.fetchProvisionedDashboardPath.mockResolvedValue('/test/dashboard.json');

  mockUseDeleteRepositoryFilesWithPathMutation.mockReturnValue([mockDeleteMutation, { isLoading }]);

  const mockRootItems = [
    { uid: 'folder-1', title: 'Test Folder', kind: 'folder' },
    { uid: 'dashboard-1', title: 'Test Dashboard', kind: 'dashboard' },
  ];

  mockStateHooks.useChildrenByParentUIDState.mockReturnValue({});
  mockStateHooks.rootItemsSelector.mockReturnValue({ items: mockRootItems });
  mockStateUtils.findItem.mockImplementation((rootItems: unknown[], childrenByUID: unknown, uid: string) => {
    return mockRootItems.find((item) => item.uid === uid);
  });

  mockDeleteMutation.mockReturnValue({
    unwrap: jest.fn().mockResolvedValue({ urls: {} }),
  });

  const renderResult = render(
    <BulkDeleteProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
  );

  return {
    onDismiss,
    mockDeleteMutation,
    ...renderResult,
  };
}

describe('BulkDeleteProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations
    mockDeleteMutation.mockClear();
    // Suppress console errors from RTK Query infrastructure
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the delete warning and form', () => {
    setup();

    expect(screen.getByText(/This will delete selected folders and their descendants/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('calls onDismiss when Cancel is clicked', async () => {
    const { user, onDismiss } = setup();

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('handles successful deletion', async () => {
    const { user, mockDeleteMutation } = setup();

    mockDeleteMutation.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({
        urls: { repositoryURL: 'https://github.com/test/repo' },
      }),
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(mockDeleteMutation).toHaveBeenCalledTimes(2); // folder + dashboard
    });

    await waitFor(() => {
      expect(screen.getByText(/All resources have been deleted successfully/)).toBeInTheDocument();
    });
  });

  it('handles deletion errors', async () => {
    const { user, mockDeleteMutation } = setup();

    mockDeleteMutation.mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('Network error')),
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      // Should have errors for both folder and dashboard
      const errors = screen.getAllByText(/Network error/);
      expect(errors).toHaveLength(2);
    });
  });

  it('shows loading state during deletion', async () => {
    const { user, mockDeleteMutation } = setup();

    // Make deletion slow
    mockDeleteMutation.mockReturnValue({
      unwrap: jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ urls: {} }), 100))),
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(screen.getByText(/Deleting.../)).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    setup(true);

    expect(screen.getByRole('button', { name: /Deleting.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
  });

  it('returns null when repository is not available', () => {
    const { container } = setup(false, null);

    expect(container.firstChild).toBeNull();
  });
});
