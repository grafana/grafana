import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import {
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/api/dashboardLibraryApi';
import { SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import {
  createMockGnetDashboard,
  createMockPluginDashboard,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/test-utils';

import {
  SuggestedDashboardsLoader,
  type SuggestedDashboardsLoaderChildProps,
  clearDashboardCache,
} from './SuggestedDashboardsLoader';

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/api/dashboardLibraryApi', () => ({
  fetchProvisionedDashboards: jest.fn(),
  fetchCommunityDashboards: jest.fn(),
}));

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/SuggestedDashboardsModal', () => ({
  SuggestedDashboardsModal: ({
    isOpen,
    onDismiss,
    communityTotalPages,
  }: {
    isOpen: boolean;
    onDismiss: () => void;
    communityTotalPages: number;
  }) =>
    isOpen ? (
      <div data-testid="modal" onClick={onDismiss}>
        Modal
        <span data-testid="community-total-pages">{communityTotalPages}</span>
      </div>
    ) : null,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn((uid?: string) => (uid ? { uid, type: 'test-datasource', name: 'Test DS' } : null)),
  }),
}));

const mockFetchProvisioned = jest.mocked(fetchProvisionedDashboards);
const mockFetchCommunity = jest.mocked(fetchCommunityDashboards);

const renderLoader = (props?: Partial<Parameters<typeof SuggestedDashboardsLoader>[0]>) => {
  let childProps!: SuggestedDashboardsLoaderChildProps;
  const { unmount, user } = render(
    <SuggestedDashboardsLoader
      datasourceUid="test-uid"
      sourceEntryPoint={SOURCE_ENTRY_POINTS.DATASOURCE_PAGE_BUILD_BUTTON}
      {...props}
    >
      {(p) => {
        childProps = p;
        return <button onClick={p.openModal}>Open</button>;
      }}
    </SuggestedDashboardsLoader>
  );
  return { getChildProps: () => childProps, unmount, user };
};

beforeEach(() => {
  jest.clearAllMocks();
  clearDashboardCache();
  mockFetchProvisioned.mockResolvedValue([]);
  mockFetchCommunity.mockResolvedValue({ page: 1, pages: 1, items: [] });
});

describe('SuggestedDashboardsLoader', () => {
  describe('initial state', () => {
    it('has fetchStatus idle and hasDashboards false before any fetch', () => {
      const { getChildProps } = renderLoader();
      expect(getChildProps().fetchStatus).toBe('idle');
      expect(getChildProps().hasDashboards).toBe(false);
    });
  });

  describe('fetchOnMount', () => {
    it('triggers fetch on mount when fetchOnMount=true', async () => {
      renderLoader({ fetchOnMount: true });

      await waitFor(() => {
        expect(mockFetchProvisioned).toHaveBeenCalledTimes(1);
        expect(mockFetchCommunity).toHaveBeenCalledTimes(1);
      });
    });

    it('does not trigger fetch when fetchOnMount is omitted', async () => {
      const { getChildProps } = renderLoader();

      expect(mockFetchProvisioned).not.toHaveBeenCalled();
      expect(mockFetchCommunity).not.toHaveBeenCalled();
      expect(getChildProps().fetchStatus).toBe('idle');
    });
  });

  describe('triggerFetch', () => {
    it('calls both API functions in parallel and transitions to done', async () => {
      const provisioned = [createMockPluginDashboard()];
      mockFetchProvisioned.mockResolvedValue(provisioned);
      mockFetchCommunity.mockResolvedValue({ page: 1, pages: 1, items: [] });

      const { getChildProps } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('done');
      });

      expect(mockFetchProvisioned).toHaveBeenCalledTimes(1);
      expect(mockFetchCommunity).toHaveBeenCalledTimes(1);
    });

    it('sets hasDashboards=true when results are non-empty', async () => {
      mockFetchProvisioned.mockResolvedValue([createMockPluginDashboard()]);
      mockFetchCommunity.mockResolvedValue({ page: 1, pages: 1, items: [] });

      const { getChildProps } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().hasDashboards).toBe(true);
      });
    });

    it('is idempotent — calling twice only makes one round of API calls', async () => {
      const { getChildProps } = renderLoader();

      await act(async () => {
        getChildProps().triggerFetch();
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('done');
      });

      expect(mockFetchProvisioned).toHaveBeenCalledTimes(1);
      expect(mockFetchCommunity).toHaveBeenCalledTimes(1);
    });
  });

  describe('onFetchComplete callback', () => {
    it('calls onFetchComplete(true) when at least one dashboard exists', async () => {
      const onFetchComplete = jest.fn();
      mockFetchProvisioned.mockResolvedValue([createMockPluginDashboard()]);

      const { getChildProps } = renderLoader({ onFetchComplete });
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(onFetchComplete).toHaveBeenCalledWith(true);
      });
    });

    it('calls onFetchComplete(false) when both collections are empty', async () => {
      const onFetchComplete = jest.fn();

      const { getChildProps } = renderLoader({ onFetchComplete });
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(onFetchComplete).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('datasource not found', () => {
    it('sets fetchStatus=done, hasDashboards=false, and calls onFetchComplete(false)', async () => {
      const onFetchComplete = jest.fn();
      // Render with empty uid so getInstanceSettings returns null
      const { getChildProps } = renderLoader({ datasourceUid: '', onFetchComplete });
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('done');
        expect(getChildProps().hasDashboards).toBe(false);
        expect(onFetchComplete).toHaveBeenCalledWith(false);
      });

      expect(mockFetchProvisioned).not.toHaveBeenCalled();
      expect(mockFetchCommunity).not.toHaveBeenCalled();
    });
  });

  describe('API error', () => {
    it('sets fetchStatus=error when fetch throws', async () => {
      mockFetchCommunity.mockRejectedValue(new Error('Network error'));

      const { getChildProps } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('error');
      });
    });

    it('does not call onFetchComplete on error', async () => {
      const onFetchComplete = jest.fn();
      mockFetchCommunity.mockRejectedValue(new Error('Network error'));

      const { getChildProps } = renderLoader({ onFetchComplete });
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('error');
      });

      expect(onFetchComplete).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('shows the modal after clicking the open button', async () => {
      const { user } = renderLoader();

      await user.click(screen.getByRole('button', { name: 'Open' }));

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });
    });

    it('triggers fetch when openModal is called', async () => {
      const { user } = renderLoader();

      await user.click(screen.getByRole('button', { name: 'Open' }));

      await waitFor(() => {
        expect(mockFetchProvisioned).toHaveBeenCalledTimes(1);
        expect(mockFetchCommunity).toHaveBeenCalledTimes(1);
      });
    });

    it('only fetches once even if openModal is called multiple times', async () => {
      const { getChildProps, user } = renderLoader();

      // First click opens modal and triggers fetch
      await user.click(screen.getByRole('button', { name: 'Open' }));

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('done');
      });

      // Dismiss modal
      await user.click(screen.getByTestId('modal'));

      // Second click should not re-fetch
      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(mockFetchProvisioned).toHaveBeenCalledTimes(1);
      expect(mockFetchCommunity).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasDashboards', () => {
    it('is false when both provisioned and community arrays are empty', async () => {
      const { getChildProps } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('done');
      });

      expect(getChildProps().hasDashboards).toBe(false);
    });

    it('is true when only provisioned dashboards exist', async () => {
      mockFetchProvisioned.mockResolvedValue([createMockPluginDashboard()]);

      const { getChildProps } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().hasDashboards).toBe(true);
      });
    });

    it('is true when only community dashboards exist', async () => {
      mockFetchCommunity.mockResolvedValue({
        page: 1,
        pages: 1,
        items: [createMockGnetDashboard()],
      });

      const { getChildProps } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });

      await waitFor(() => {
        expect(getChildProps().hasDashboards).toBe(true);
      });
    });
  });

  describe('module-level cache', () => {
    it('restores communityTotalPages from cache on second mount', async () => {
      mockFetchCommunity.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      // First mount — fetches from API and populates the cache
      const { getChildProps, unmount } = renderLoader();
      await act(async () => {
        getChildProps().triggerFetch();
      });
      await waitFor(() => {
        expect(getChildProps().fetchStatus).toBe('done');
      });

      unmount();

      // Second mount — should restore communityTotalPages from cache without re-fetching
      // Do NOT call clearDashboardCache() so the cache is still populated
      const { getChildProps: getChildProps2 } = renderLoader();
      await act(async () => {
        getChildProps2().openModal();
      });
      await waitFor(() => {
        expect(getChildProps2().fetchStatus).toBe('done');
      });

      // API should only have been called once (during the first mount)
      expect(mockFetchCommunity).toHaveBeenCalledTimes(1);

      // The modal should receive the cached communityTotalPages value
      expect(screen.getByTestId('community-total-pages')).toHaveTextContent('5');
    });
  });
});
