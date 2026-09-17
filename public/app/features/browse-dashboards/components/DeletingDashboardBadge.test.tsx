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

const mockGetDashboardDTO = jest.fn();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => Promise.resolve({ getDashboardDTO: mockGetDashboardDTO }),
}));

describe('DeletingDashboardBadge', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Deleting badge while the dashboard still has a deletionTimestamp', async () => {
    mockGetDashboardDTO.mockResolvedValue({
      meta: { k8s: { deletionTimestamp: '2024-01-01T00:00:00Z' } },
    });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />);

    expect(await screen.findByText('Deleting')).toBeInTheDocument();
  });

  it('renders nothing once the dashboard is confirmed gone (404)', async () => {
    mockGetDashboardDTO.mockRejectedValue({ status: 404, data: {} });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />);

    await waitFor(() => expect(screen.queryByText('Deleting')).not.toBeInTheDocument());
  });

  it('renders nothing once the dashboard no longer has a deletionTimestamp', async () => {
    mockGetDashboardDTO.mockResolvedValue({ meta: { k8s: {} } });

    render(<DeletingDashboardBadge dashboardUID="dash-1" />);

    await waitFor(() => expect(screen.queryByText('Deleting')).not.toBeInTheDocument());
  });
});
