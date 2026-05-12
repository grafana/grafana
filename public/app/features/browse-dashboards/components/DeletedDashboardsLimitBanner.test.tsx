import { render, screen, waitFor } from 'test/test-utils';

import { store } from '@grafana/data';
import { type ListMeta, type ResourceList } from 'app/features/apiserver/types';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';

import { DISMISS_STORAGE_KEY, DeletedDashboardsLimitBanner } from './DeletedDashboardsLimitBanner';

jest.mock('../../search/service/deletedDashboardsCache', () => ({
  deletedDashboardsCache: {
    getAsResourceList: jest.fn(),
  },
}));

const mockGetAsResourceList = deletedDashboardsCache.getAsResourceList as jest.MockedFunction<
  typeof deletedDashboardsCache.getAsResourceList
>;

function buildList(count: number, metadata: Partial<ListMeta> = {}): ResourceList<DashboardDataDTO> {
  return {
    apiVersion: 'v1',
    kind: 'List',
    metadata: { resourceVersion: '0', ...metadata },
    items: Array.from({ length: count }, (_, i) => ({
      apiVersion: 'dashboard.grafana.app/v1beta1',
      kind: 'Dashboard',
      metadata: { name: `d-${i}`, resourceVersion: '0', creationTimestamp: '2024-01-01T00:00:00Z' },
      spec: {} as DashboardDataDTO,
    })),
  };
}

function mockCache(list: ResourceList<DashboardDataDTO>) {
  mockGetAsResourceList.mockResolvedValue(list);
}

const atLimitAlert = { name: /deleted dashboards limit reached/i };

describe('DeletedDashboardsLimitBanner', () => {
  beforeEach(() => {
    store.delete(DISMISS_STORAGE_KEY);
    mockGetAsResourceList.mockReset();
  });

  describe('does not render', () => {
    it('when count is below the limit', async () => {
      mockCache(buildList(999));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);
      await waitFor(() => {
        expect(mockGetAsResourceList).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('when the cache returns an empty list (fetch failed)', async () => {
      mockCache(buildList(0));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);
      await waitFor(() => {
        expect(mockGetAsResourceList).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('when continue is set but count + 1 stays below the limit', async () => {
      // listFromTrash cuts pages when pageBytes >= maxPageBytes (default 2 MiB), so a small page
      // with `continue` set is a legitimate shape that must not trigger at_limit.
      mockCache(buildList(998, { continue: 'next-page-token' }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);
      await waitFor(() => {
        expect(mockGetAsResourceList).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('at_limit state', () => {
    it('renders when count === 1000 with no continuation token (future-proof path)', async () => {
      mockCache(buildList(1000));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      const alert = await screen.findByRole('alert', atLimitAlert);
      expect(alert).toHaveTextContent(/Grafana retains up to 1000 recently deleted dashboards/i);
    });

    it("renders when count === 1000 and continue is set (today's overage path)", async () => {
      mockCache(buildList(1000, { continue: 'next-page-token' }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    });

    it('renders when count === 999 and continue is set (backend chunked below the limit)', async () => {
      mockCache(buildList(999, { continue: 'next-page-token' }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    });

    it('renders when remainingItemCount > 0 and continue is absent', async () => {
      mockCache(buildList(500, { remainingItemCount: 600 }));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('hides the banner when the dismiss button is clicked and persists `true` in localStorage', async () => {
      mockCache(buildList(1000));
      const { user } = render(<DeletedDashboardsLimitBanner resultToken={1} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /close alert/i }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(store.getObject(DISMISS_STORAGE_KEY)).toBe(true);
    });

    it('stays hidden across mounts when storage has `true`', async () => {
      store.setObject(DISMISS_STORAGE_KEY, true);
      mockCache(buildList(1000));
      render(<DeletedDashboardsLimitBanner resultToken={1} />);

      await waitFor(() => {
        expect(mockGetAsResourceList).toHaveBeenCalled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('reactivity', () => {
    it('re-reads the cache when resultToken changes', async () => {
      mockCache(buildList(500));
      const { rerender } = render(<DeletedDashboardsLimitBanner resultToken={1} />);

      await waitFor(() => {
        expect(mockGetAsResourceList).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      mockCache(buildList(1000));
      rerender(<DeletedDashboardsLimitBanner resultToken={2} />);

      expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
      expect(mockGetAsResourceList).toHaveBeenCalledTimes(2);
    });
  });
});
