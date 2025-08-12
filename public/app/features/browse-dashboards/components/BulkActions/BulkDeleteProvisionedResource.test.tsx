import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { backendSrv } from 'app/core/services/backend_srv';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';

// Set up backendSrv as recommended in the PR comment
setBackendSrv(backendSrv);
setupMockServer();

jest.mock('../utils', () => ({
  collectSelectedItems: jest.fn().mockReturnValue([
    { uid: 'folder-1', isFolder: true, displayName: 'Test Folder' },
    { uid: 'dashboard-1', isFolder: false, displayName: 'Test Dashboard' },
  ]),
  fetchProvisionedDashboardPath: jest.fn().mockResolvedValue('/test/dashboard.json'),
}));

jest.mock('../../state/hooks', () => ({
  useChildrenByParentUIDState: jest.fn().mockReturnValue({}),
  rootItemsSelector: jest.fn().mockReturnValue({
    items: [
      { uid: 'folder-1', title: 'Test Folder', kind: 'folder' },
      { uid: 'dashboard-1', title: 'Test Dashboard', kind: 'dashboard' },
    ],
  }),
}));

jest.mock('../../state/utils', () => ({
  findItem: jest.fn().mockImplementation((rootItems: unknown[], childrenByUID: unknown, uid: string) => {
    const mockRootItems = [
      { uid: 'folder-1', title: 'Test Folder', kind: 'folder' },
      { uid: 'dashboard-1', title: 'Test Dashboard', kind: 'dashboard' },
    ];
    return mockRootItems.find((item) => item.uid === uid);
  }),
}));

jest.mock('../BrowseActions/DescendantCount', () => ({
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

jest.mock('../BrowseActions/useSelectionRepoValidation', () => ({
  useSelectionRepoValidation: jest.fn(),
}));

describe('BulkDeleteProvisionedResource', () => {
  const defaultRepository: RepositoryView = {
    name: 'test-folder', // This must match the folderUid passed to the component
    type: 'github',
    title: 'Test Repository',
    target: 'folder',
    workflows: ['branch', 'write'],
  };

  const selectedItems = {
    folder: { 'folder-1': true },
    dashboard: { 'dashboard-1': true },
  };

  beforeEach(() => {
    server.use(
      http.delete('/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/:name/files/*', () => {
        return HttpResponse.json({
          urls: { repositoryURL: 'https://github.com/test/repo' },
        });
      })
    );
    jest.clearAllMocks();

    const { useGetResourceRepositoryView } = jest.requireMock(
      'app/features/provisioning/hooks/useGetResourceRepositoryView'
    );
    useGetResourceRepositoryView.mockReturnValue({
      repository: defaultRepository,
      folder: {
        metadata: {
          annotations: {
            'grafana.app/file-path': '/test/folder',
          },
        },
      },
      isInstanceManaged: false,
    });

    const { useSelectionRepoValidation } = jest.requireMock('../BrowseActions/useSelectionRepoValidation');
    useSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: 'test-folder',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup(repository: RepositoryView | null = defaultRepository) {
    const onDismiss = jest.fn();

    const { useGetResourceRepositoryView } = jest.requireMock(
      'app/features/provisioning/hooks/useGetResourceRepositoryView'
    );
    useGetResourceRepositoryView.mockReturnValue({
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
      isInstanceManaged: false,
    });

    const { useSelectionRepoValidation } = jest.requireMock('../BrowseActions/useSelectionRepoValidation');
    useSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: repository?.name || 'test-folder',
    });

    const renderResult = render(
      <BulkDeleteProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    return {
      onDismiss,
      ...renderResult,
    };
  }

  it('renders the delete warning and form', async () => {
    setup();

    expect(await screen.findByText(/This will delete selected folders and their descendants/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('calls onDismiss when Cancel is clicked', async () => {
    const { onDismiss, user } = setup();

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('handles successful deletion', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(await screen.findByText(/All resources have been deleted successfully/)).toBeInTheDocument();
  });

  it('handles deletion errors', async () => {
    const { user } = setup();

    // Mock API to return error for this test
    server.use(
      http.delete('/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/:name/files/*', () => {
        return HttpResponse.json({ message: 'Network error' }, { status: 500 });
      })
    );

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      // Should show error alert with failed items
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByLabelText(/items failed/)).toBeInTheDocument();

      // Should have error list items for both folder and dashboard
      const errorItems = screen.getAllByRole('listitem');
      expect(errorItems).toHaveLength(2); // One for folder, one for dashboard
    });
  });

  it('shows loading state during deletion', async () => {
    const { user } = setup();

    // Mock slow API response
    server.use(
      http.delete('/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/:name/files/*', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({
          urls: { repositoryURL: 'https://github.com/test/repo' },
        });
      })
    );

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(screen.getByText(/Deleting.../)).toBeInTheDocument();
  });

  it('returns null when repository is not available', () => {
    setup(null);

    expect(screen.getByLabelText('Repository not found')).toBeInTheDocument();
  });
});
