import { render, screen, waitFor } from 'test/test-utils';

import { store } from '@grafana/data';
import { EMPTY_TABLE_RESPONSE, type ListMeta, type TableResponse } from 'app/features/apiserver/types';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';

import { DISMISS_STORAGE_KEY, DeletedDashboardsLimitBanner } from './DeletedDashboardsLimitBanner';

jest.mock('../../search/service/deletedDashboardsCache', () => ({
  deletedDashboardsCache: {
    getAsTable: jest.fn(),
  },
}));

const mockGetAsTable = deletedDashboardsCache.getAsTable as jest.MockedFunction<
  typeof deletedDashboardsCache.getAsTable
>;

function buildTable(count: number, metadata: Partial<ListMeta> = {}): TableResponse {
  return {
    ...EMPTY_TABLE_RESPONSE,
    metadata: { resourceVersion: '0', ...metadata },
    rows: Array.from({ length: count }, (_, i) => ({
      cells: [],
      object: {
        metadata: { name: `d-${i}`, resourceVersion: '0', creationTimestamp: '2024-01-01T00:00:00Z' },
      },
    })),
  };
}

function mockCache(table: TableResponse) {
  mockGetAsTable.mockResolvedValue(table);
}

const atLimitAlert = { name: /deleted dashboards limit reached/i };

describe('DeletedDashboardsLimitBanner', () => {
  beforeEach(() => {
    store.delete(DISMISS_STORAGE_KEY);
    mockGetAsTable.mockReset();
  });

  describe('does not render', () => {
    it('when count is below the limit', async () => {
      mockCache(buildTable(999));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);
      await waitFor(() => {
        expect(mockGetAsTable).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('when the cache returns an empty table (fetch failed)', async () => {
      mockCache(buildTable(0));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);
      await waitFor(() => {
        expect(mockGetAsTable).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('when continue is set but count + 1 stays below the limit', async () => {
      // listFromTrash cuts pages when pageBytes >= maxPageBytes (default 2 MiB), so a small page
      // with `continue` set is a legitimate shape that must not trigger at_limit.
      mockCache(buildTable(998, { continue: 'next-page-token' }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);
      await waitFor(() => {
        expect(mockGetAsTable).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('at_limit state', () => {
    it('renders when count === 1000 with no continuation token (future-proof path)', async () => {
      mockCache(buildTable(1000));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      const alert = await screen.findByRole('alert', atLimitAlert);
      expect(alert).toHaveTextContent(/Grafana retains up to 1000 recently deleted dashboards/i);
    });

    it("renders when count === 1000 and continue is set (today's overage path)", async () => {
      mockCache(buildTable(1000, { continue: 'next-page-token' }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    });

    it('renders when count === 999 and continue is set (backend chunked below the limit)', async () => {
      mockCache(buildTable(999, { continue: 'next-page-token' }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    });

    it('renders when remainingItemCount > 0 and continue is absent', async () => {
      mockCache(buildTable(500, { remainingItemCount: 600 }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('hides the banner when the dismiss button is clicked and persists `true` in localStorage', async () => {
      mockCache(buildTable(1000));
      const { user } = render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /close alert/i }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(store.getObject(DISMISS_STORAGE_KEY)).toBe(true);
    });

    it('stays hidden across mounts when storage has `true`', async () => {
      store.setObject(DISMISS_STORAGE_KEY, true);
      mockCache(buildTable(1000));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      await waitFor(() => {
        expect(mockGetAsTable).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('reactivity', () => {
    it('re-reads the cache when resultToken changes', async () => {
      mockCache(buildTable(500));
      const { rerender } = render(<DeletedDashboardsLimitBanner resultToken={1} />);

      await waitFor(() => {
        expect(mockGetAsTable).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      mockCache(buildTable(1000));
      rerender(<DeletedDashboardsLimitBanner resultToken={2} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
      expect(mockGetAsTable).toHaveBeenCalledTimes(2);
    });
  });
});
