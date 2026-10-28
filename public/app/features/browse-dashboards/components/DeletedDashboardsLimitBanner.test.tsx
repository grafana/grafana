import { render, screen } from 'test/test-utils';

import { store } from '@grafana/data';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';

import { DISMISS_STORAGE_KEY, DeletedDashboardsLimitBanner } from './DeletedDashboardsLimitBanner';

jest.mock('../../search/service/deletedDashboardsCache', () => ({
  DELETED_DASHBOARDS_LIMIT: jest.requireActual('../../search/service/deletedDashboardsCache').DELETED_DASHBOARDS_LIMIT,
  deletedDashboardsCache: {
    isTrashTruncated: jest.fn(),
  },
}));

const mockIsTrashTruncated = deletedDashboardsCache.isTrashTruncated as jest.MockedFunction<
  typeof deletedDashboardsCache.isTrashTruncated
>;

const atLimitAlert = { name: /showing at most 1000 deleted dashboards/i };

describe('DeletedDashboardsLimitBanner', () => {
  beforeEach(() => {
    store.delete(DISMISS_STORAGE_KEY);
    mockIsTrashTruncated.mockReset();
  });

  it('does not render when the list holds everything that matched', () => {
    mockIsTrashTruncated.mockReturnValue(false);
    render(<DeletedDashboardsLimitBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders when the list stopped at the limit with more still available', () => {
    mockIsTrashTruncated.mockReturnValue(true);
    render(<DeletedDashboardsLimitBanner />);

    expect(screen.getByRole('status', atLimitAlert)).toHaveTextContent(/This list is limited to 1000 dashboards/i);
  });

  // The page re-renders after every search, which is when truncation can change.
  it('follows the cache across renders', () => {
    mockIsTrashTruncated.mockReturnValue(false);
    const { rerender } = render(<DeletedDashboardsLimitBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    mockIsTrashTruncated.mockReturnValue(true);
    rerender(<DeletedDashboardsLimitBanner />);
    expect(screen.getByRole('status', atLimitAlert)).toBeInTheDocument();
  });

  it('hides when dismissed, and remembers that in storage', async () => {
    mockIsTrashTruncated.mockReturnValue(true);
    const { user } = render(<DeletedDashboardsLimitBanner />);

    await user.click(screen.getByRole('button', { name: /close alert/i }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(store.getObject(DISMISS_STORAGE_KEY)).toBe(true);
  });

  it('stays hidden on a later visit once dismissed', () => {
    store.setObject(DISMISS_STORAGE_KEY, true);
    mockIsTrashTruncated.mockReturnValue(true);
    render(<DeletedDashboardsLimitBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
