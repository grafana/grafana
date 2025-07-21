import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';
import { collectSelectedItems, fetchProvisionedDashboardPath } from '../utils';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';

const mockPublish = jest.fn();
const mockReload = jest.fn();

Object.defineProperty(window, 'location', {
  value: {
    reload: mockReload,
  },
  writable: true,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: mockPublish,
  })),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useDeleteRepositoryFilesWithPathMutation: jest.fn(),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView');

jest.mock('../../state/hooks', () => ({
  useChildrenByParentUIDState: jest.fn(),
  rootItemsSelector: jest.fn(),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn(),
}));

jest.mock('../BrowseActions/DescendantCount', () => ({
  DescendantCount: () => <div data-testid="descendant-count">2 folders, 5 dashboards</div>,
}));

jest.mock('./BulkActionFailureBanner', () => ({
  BulkActionFailureBanner: ({ result }: { result?: unknown[] }) =>
    result && result.length > 0 ? <div data-testid="failure-banner">Failure Banner</div> : null,
}));

jest.mock('./BulkActionProgress', () => ({
  BulkActionProgress: () => <div data-testid="progress" />,
}));

jest.mock('app/features/dashboard-scene/saving/provisioned/defaults', () => ({
  getDefaultWorkflow: jest.fn((repository) => (repository ? 'write' : undefined)),
  getWorkflowOptions: jest.fn((repository) =>
    repository
      ? [
          { label: 'Write directly', value: 'write' },
          { label: 'Create branch', value: 'branch' },
        ]
      : []
  ),
}));

jest.mock('../utils', () => ({
  collectSelectedItems: jest.fn(() => []),
  fetchProvisionedDashboardPath: jest.fn(() => Promise.resolve('/path/to/dashboard')),
}));

jest.mock('../../state/utils', () => ({
  findItem: jest.fn(),
}));

const mockUseDeleteRepositoryFilesMutation = jest.mocked(useDeleteRepositoryFilesWithPathMutation);
const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseChildrenByParentUIDState = jest.mocked(useChildrenByParentUIDState);

// Mock data
const mockRepository = {
  name: 'test-repo',
  type: 'github' as const,
  target: 'folder' as const,
  title: 'Test Repository',
  workflows: ['branch', 'write'] as Array<'branch' | 'write'>,
  branch: 'main',
};

const mockFolder = {
  metadata: {
    name: 'test-folder',
    annotations: {
      'grafana.app/source-path': '/test/path',
    },
  },
  spec: {
    title: 'Test Folder',
  },
  status: {},
};

const mockSelectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'> = {
  dashboard: { 'dashboard-1': true },
  folder: { 'folder-1': true },
};

const mockDeleteRepoFile = jest.fn();

interface Props {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  onDismiss?: () => void;
}

interface MockConfig {
  selectedItems?: Array<{
    uid: string;
    isFolder: boolean;
    displayName: string;
  }>;
  dashboardPath?: string;
  findItemImpl?: (
    items: unknown,
    children: unknown,
    uid: string
  ) => { uid: string; title: string; kind: string } | undefined;
  deleteResponse?: {
    unwrap: () => Promise<unknown>;
  };
  deleteError?: Error;
  mutationState?: {
    isLoading?: boolean;
    isSuccess?: boolean;
    isError?: boolean;
    error?: null;
  };
}

type SetupProps = {
  props?: Partial<Props>;
  repository?: typeof mockRepository;
  folder?: typeof mockFolder;
  childrenByParentUID?: ReturnType<typeof useChildrenByParentUIDState>;
  rootItems?: ReturnType<typeof rootItemsSelector>;
  mockConfig?: MockConfig;
};

const mockSuccessResponse = {
  urls: { repositoryURL: 'https://github.com/test/repo/pull/123' },
};

function setup({
  props = {},
  repository = mockRepository,
  folder = mockFolder,
  childrenByParentUID = {},
  rootItems = {
    items: [],
    lastFetchedKind: 'folder',
    lastFetchedPage: 1,
    lastKindHasMoreItems: false,
    isFullyLoaded: true,
  },
  mockConfig = {},
}: SetupProps) {
  const mockRepositoryViewResult = {
    repository,
    folder,
    isLoading: false,
    isInstanceManaged: false,
  };

  // Setup mutation mock with configurable response
  if (mockConfig.deleteResponse) {
    mockDeleteRepoFile.mockImplementation(() => mockConfig.deleteResponse);
  } else if (mockConfig.deleteError) {
    mockDeleteRepoFile.mockImplementation(() => ({
      unwrap: () => Promise.reject(mockConfig.deleteError),
    }));
  }

  // Setup hooks mocks
  mockUseDeleteRepositoryFilesMutation.mockReturnValue([
    mockDeleteRepoFile,
    {
      isLoading: mockConfig.mutationState?.isLoading ?? false,
      isSuccess: mockConfig.mutationState?.isSuccess ?? false,
      isError: mockConfig.mutationState?.isError ?? false,
      error: mockConfig.mutationState?.error ?? null,
      reset: jest.fn(),
    },
  ]);
  mockUseGetResourceRepositoryView.mockReturnValue(mockRepositoryViewResult);
  mockUseChildrenByParentUIDState.mockReturnValue(childrenByParentUID);

  // Setup utility function mocks
  const mockCollectSelectedItems = jest.mocked(collectSelectedItems);
  const mockFetchProvisionedDashboardPath = jest.mocked(fetchProvisionedDashboardPath);
  const mockFindItem = jest.mocked(findItem);

  mockCollectSelectedItems.mockReturnValue(mockConfig.selectedItems || []);
  mockFetchProvisionedDashboardPath.mockResolvedValue(mockConfig.dashboardPath || '/path/to/dashboard.json');
  if (mockConfig.findItemImpl) {
    mockFindItem.mockImplementation(mockConfig.findItemImpl as never);
  } else {
    mockFindItem.mockReturnValue(undefined);
  }

  // Setup useSelector mock
  const mockUseSelector = jest.mocked(useSelector);
  mockUseSelector.mockImplementation((selector: unknown) => {
    if (selector === rootItemsSelector) {
      return rootItems;
    }
    return undefined;
  });

  const onDismiss = jest.fn();
  const defaultProps: Props = {
    folderUid: 'test-folder-uid',
    selectedItems: mockSelectedItems,
    onDismiss,
  };

  const renderResult = render(<BulkDeleteProvisionedResource {...defaultProps} {...props} />);

  return {
    ...renderResult,
    onDismiss,
    mockDeleteRepoFile,
    mockNavigate,
    mockPublish,
    mockReload,
  };
}

describe('BulkDeleteProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockPublish.mockClear();
    mockReload.mockClear();
  });

  describe('rendering', () => {
    it('should render component correctly', () => {
      setup({});

      // Check for warning text
      expect(screen.getByText(/This will delete selected folders and their descendants/)).toBeInTheDocument();

      // Check for descendant count
      expect(screen.getByTestId('descendant-count')).toBeInTheDocument();

      // Check for delete and cancel buttons
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not render when repository is not available', () => {
      // Mock the hook to return undefined repository before rendering
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: undefined,
        folder: undefined,
        isLoading: false,
        isInstanceManaged: false,
      });

      const { container } = render(
        <BulkDeleteProvisionedResource
          folderUid="test-folder-uid"
          selectedItems={mockSelectedItems}
          onDismiss={jest.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('delete functionality', () => {
    it('should handle successful delete operation', async () => {
      const { mockDeleteRepoFile } = setup({
        mockConfig: {
          selectedItems: [
            { uid: 'dashboard-1', isFolder: false, displayName: 'Test Dashboard' },
            { uid: 'folder-1', isFolder: true, displayName: 'Test Folder' },
          ],
          dashboardPath: '/path/to/dashboard.json',
          deleteResponse: {
            unwrap: () => Promise.resolve(mockSuccessResponse),
          },
          findItemImpl: (items: unknown, children: unknown, uid: string) => {
            if (uid === 'dashboard-1') {
              return { uid: 'dashboard-1', title: 'Test Dashboard', kind: 'dashboard' };
            }
            if (uid === 'folder-1') {
              return { uid: 'folder-1', title: 'Test Folder', kind: 'folder' };
            }
            return undefined;
          },
        },
      });

      // Click delete button
      const user = userEvent.setup();
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Wait for delete operations to complete
      await waitFor(
        () => {
          expect(mockDeleteRepoFile).toHaveBeenCalledTimes(2);
        },
        { timeout: 3000 }
      );
      await waitFor(
        () => {
          expect(mockPublish).toHaveBeenCalledWith({
            type: 'alert-success',
            payload: ['Successfully deleted 2 items'],
          });
        },
        { timeout: 3000 }
      );

      expect(mockReload).toHaveBeenCalled();
    });

    it('should handle delete operation with failures', async () => {
      setup({
        mockConfig: {
          selectedItems: [{ uid: 'dashboard-1', isFolder: false, displayName: 'Test Dashboard' }],
          findItemImpl: () => undefined, // This will cause path not found error
        },
      });

      // Click delete button
      const user = userEvent.setup();
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Wait for form submission and verify delete was not called due to missing path
      await waitFor(
        () => {
          expect(mockDeleteRepoFile).not.toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });

    it('should handle partial failure (some succeed, some fail)', async () => {
      setup({
        mockConfig: {
          selectedItems: [
            { uid: 'dashboard-1', isFolder: false, displayName: 'Success Dashboard' },
            { uid: 'dashboard-2', isFolder: false, displayName: 'Failed Dashboard' },
          ],
          dashboardPath: '/path/to/dashboard.json',
          deleteResponse: {
            unwrap: () => Promise.resolve(mockSuccessResponse),
          },
          findItemImpl: (items: unknown, children: unknown, uid: string) => {
            if (uid === 'dashboard-1') {
              return { uid: 'dashboard-1', title: 'Success Dashboard', kind: 'dashboard' };
            }
            if (uid === 'dashboard-2') {
              return undefined; // This will cause path not found error
            }
            return undefined;
          },
        },
      });

      // Click delete button
      const user = userEvent.setup();
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Wait for operations to complete - only one should succeed, one should fail
      await waitFor(
        () => {
          expect(mockDeleteRepoFile).toHaveBeenCalledTimes(1); // Only called for successful item
        },
        { timeout: 3000 }
      );

      // Should NOT show success message since there are failures
      expect(mockPublish).not.toHaveBeenCalled();

      // Should NOT reload page since there are failures
      expect(mockReload).not.toHaveBeenCalled();

      // Should show failure banner (mocked component would render)
      expect(screen.getByTestId('failure-banner')).toBeInTheDocument();
    });
  });
});
