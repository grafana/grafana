import { render, screen } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';

import { FolderCascadeStatusBanner } from './FolderCascadeStatusBanner';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1'),
  useGetFolderQuery: jest.fn(),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;

function makeFolder(overrides: Partial<Folder['metadata']> = {}, status?: Folder['status']): Folder {
  return {
    metadata: { name: 'folder-1', deletionTimestamp: '2024-01-01T00:00:00Z', ...overrides },
    spec: { title: 'My folder' },
    status,
  } as Folder;
}

// See DeletingFolderBadge.test.tsx: fills in the RTK Query bookkeeping fields this test doesn't care about.
function mockQueryResult(result: { data?: Folder; error?: unknown }): ReturnType<typeof useGetFolderQuery> {
  return {
    data: undefined,
    currentData: undefined,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isSuccess: false,
    isError: false,
    isUninitialized: false,
    refetch: jest.fn(),
    ...result,
  } as unknown as ReturnType<typeof useGetFolderQuery>;
}

describe('FolderCascadeStatusBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the remaining count while the cascade is still working', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'working', remaining: 3 } }) })
    );

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/3 items left/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows a generic in-progress message once nothing is left to report', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'working', remaining: 0 } }) })
    );

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/deleting in the background/i)).toBeInTheDocument();
  });

  it('renders nothing once the folder no longer has a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({
        data: makeFolder(
          { deletionTimestamp: undefined },
          { cascadeDelete: { state: 'error', errors: ['boom'], remaining: 0 } }
        ),
      })
    );

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the reported errors when the cascade is stuck, without offering any action', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({
        data: makeFolder({}, { cascadeDelete: { state: 'error', errors: ['dashboard X is locked'], remaining: 0 } }),
      })
    );

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('dashboard X is locked')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the "folder deleted" modal once the folder is confirmed gone, after having seen it deleting', async () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'working', remaining: 1 } }) })
    );

    const { rerender, user } = render(<FolderCascadeStatusBanner folderUID="folder-1" />);
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ error: { status: 404, data: {} } }));
    rerender(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('dialog', { name: 'Folder deleted' })).toBeInTheDocument();

    // test-utils' render() installs its own fresh locationService for the test, so the
    // button's click ends up pushing through that instance -- assert on the resulting location
    // rather than spying on the (by-then-replaced) module-level one.
    await user.click(screen.getByRole('button', { name: /go to dashboards/i }));
    expect(locationService.getLocation().pathname).toBe('/dashboards');
  });

  it('does not show the "folder deleted" modal on a 404 before ever having confirmed the folder was actually deleting', () => {
    // Guards against a request race right after the page loads (e.g. a transient 404 before this
    // folder's real state has ever been observed) triggering a premature "it's deleted" modal.
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ error: { status: 404, data: {} } }));

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.queryByRole('dialog', { name: 'Folder deleted' })).not.toBeInTheDocument();
  });

  it("shows a warning when this folder itself isn't deleting but is blocking its parent's cascade", () => {
    // This folder has no deletionTimestamp/status of its own (it was never actually touched --
    // the delete attempt on it failed before that point), so the only way to know it's the
    // problem is by checking whether its parent's cascade named it.
    mockUseGetFolderQuery.mockImplementation((arg) => {
      if (typeof arg === 'object' && arg.name === 'parent-1') {
        return mockQueryResult({
          data: makeFolder(
            { name: 'parent-1' },
            { cascadeDelete: { state: 'error', errors: ['delete child folder folder-1: not empty'], remaining: 1 } }
          ),
        });
      }
      return mockQueryResult({ data: makeFolder({ deletionTimestamp: undefined }) });
    });

    render(<FolderCascadeStatusBanner folderUID="folder-1" parentUID="parent-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('delete child folder folder-1: not empty')).toBeInTheDocument();
  });

  it("renders nothing when the parent's cascade errors don't name this folder", () => {
    mockUseGetFolderQuery.mockImplementation((arg) => {
      if (typeof arg === 'object' && arg.name === 'parent-1') {
        return mockQueryResult({
          data: makeFolder(
            { name: 'parent-1' },
            { cascadeDelete: { state: 'error', errors: ['delete dashboard some-other-uid: locked'], remaining: 1 } }
          ),
        });
      }
      return mockQueryResult({ data: makeFolder({ deletionTimestamp: undefined }) });
    });

    render(<FolderCascadeStatusBanner folderUID="folder-1" parentUID="parent-1" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("marks this folder's already-loaded children as cascade-deleting too, for visual effect", () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'working', remaining: 2 } }) })
    );

    const { store } = render(<FolderCascadeStatusBanner folderUID="folder-1" />, {
      preloadedState: {
        browseDashboards: {
          rootItems: undefined,
          childrenByParentUID: {
            'folder-1': fullyLoadedViewItemCollection([
              { kind: 'folder', uid: 'child-folder', title: 'Child folder' },
              { kind: 'dashboard', uid: 'child-dashboard', title: 'Child dashboard' },
            ]),
          },
          openFolders: {},
          selectedItems: { $all: false, dashboard: {}, folder: {}, panel: {} },
          cascadeDeletingUIDs: {},
          cascadeDeleteErrors: {},
        },
      },
    });

    expect(store?.getState().browseDashboards.cascadeDeletingUIDs).toEqual({
      'child-folder': true,
      'child-dashboard': true,
    });
  });
});
