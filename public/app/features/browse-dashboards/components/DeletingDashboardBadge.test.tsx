import { render, screen, waitFor } from 'test/test-utils';

import { DeletingDashboardBadge } from './DeletingDashboardBadge';

// `refetchChildren` is a real thunk that hits the search service, which isn't set up in this
// unit test's environment. Keep its `.fulfilled` action matcher (slice.ts's extraReducers
// registers a case reducer against it at module load, real store and all) but replace what
// dispatching it actually does with a no-op, so the effect that calls it on unmount/404 doesn't
// crash the test.
jest.mock('../state/actions', () => {
  const actual = jest.requireActual('../state/actions');
  return {
    ...actual,
    refetchChildren: Object.assign(
      jest.fn(() => ({ type: 'test/refetchChildren/noop' })),
      {
        fulfilled: actual.refetchChildren.fulfilled,
        pending: actual.refetchChildren.pending,
        rejected: actual.refetchChildren.rejected,
        typePrefix: actual.refetchChildren.typePrefix,
      }
    ),
  };
});

const mockGet = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
}));

describe('DeletingDashboardBadge', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a Deleting badge as long as the dashboard can still be read', async () => {
    mockGet.mockResolvedValue({ metadata: {} });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />);

    expect(await screen.findByText('Deleting')).toBeInTheDocument();
  });

  it('renders nothing once the dashboard is confirmed gone (404)', async () => {
    mockGet.mockRejectedValue({ status: 404, data: {} });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />);

    await waitFor(() => expect(screen.queryByText('Deleting')).not.toBeInTheDocument());
  });

  it('suppresses the global error alert for the polling request', async () => {
    // A 404 here is the *expected* outcome once the dashboard is actually gone -- it shouldn't
    // pop a "not found" toast for every dashboard a cascade delete finishes with.
    mockGet.mockResolvedValue({ metadata: {} });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith(expect.any(String), undefined, undefined, { showErrorAlert: false });
  });

  it("shows the stuck badge using an ancestor's propagated error", async () => {
    // Dashboards have no status of their own -- the error only exists on whichever ancestor
    // folder's cascade blamed this dashboard by name (see usePropagateCascadeDeleteToChildren).
    mockGet.mockResolvedValue({ metadata: {} });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />, {
      preloadedState: {
        browseDashboards: {
          rootItems: undefined,
          childrenByParentUID: {},
          openFolders: {},
          selectedItems: { $all: false, dashboard: {}, folder: {}, panel: {} },
          cascadeDeletingUIDs: {},
          cascadeDeleteErrors: { 'dash-1': ['delete dashboard dash-1: locked'] },
        },
      },
    });

    expect(await screen.findByText('Deletion stuck')).toBeInTheDocument();
  });
});
