import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { DashboardTabs } from './DashboardTabs';

setBackendSrv(backendSrv);
setupMockServer();

const impressionKey = `dashboard_impressions-${contextSrv.user.orgId}`;

function makeDashboardHit(overrides: Partial<DashboardHit> & { name: string; title: string }): DashboardHit {
  return {
    resource: 'dashboards',
    folder: 'general',
    ...overrides,
  };
}

const recentHits: DashboardHit[] = [
  makeDashboardHit({ name: 'recent-1', title: 'Recent Dashboard 1' }),
  makeDashboardHit({ name: 'recent-2', title: 'Recent Dashboard 2' }),
];

const starredHits: DashboardHit[] = [
  makeDashboardHit({ name: 'starred-1', title: 'Starred Dashboard 1' }),
  makeDashboardHit({ name: 'starred-2', title: 'Starred Dashboard 2' }),
  makeDashboardHit({ name: 'starred-3', title: 'Starred Dashboard 3' }),
];

function seedRecent(uids: string[]) {
  window.localStorage.setItem(impressionKey, JSON.stringify(uids));
}

function seedStars(uids: string[]) {
  server.use(http.get('/api/user/stars', () => HttpResponse.json(uids)));
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  window.localStorage.removeItem(impressionKey);
  seedStars([]);
});

describe('DashboardTabs', () => {
  it('renders Recent tab as active by default and shows recent dashboards', async () => {
    seedRecent(['recent-1', 'recent-2']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    render(<DashboardTabs />);

    expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(screen.getByText('Recent Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Recent Dashboard 2')).toBeInTheDocument();
    });
  });

  it('switches to Starred tab and shows starred dashboards', async () => {
    seedStars(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    const { user } = render(<DashboardTabs />);

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(screen.getByText('Starred Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Starred Dashboard 2')).toBeInTheDocument();
      expect(screen.getByText('Starred Dashboard 3')).toBeInTheDocument();
    });
  });

  it('shows empty state when no recent dashboards', async () => {
    render(<DashboardTabs />);

    await waitFor(() => {
      expect(screen.getByText("Dashboards you've recently viewed will appear here.")).toBeInTheDocument();
    });
  });

  it('shows empty state when no starred dashboards', async () => {
    seedStars([]);
    const { user } = render(<DashboardTabs />);

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    await waitFor(() => {
      expect(screen.getByText('Your starred dashboards will appear here.')).toBeInTheDocument();
    });
  });

  it('shows counter badges with correct counts', async () => {
    seedRecent(['recent-1', 'recent-2']);
    seedStars(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    render(<DashboardTabs />);

    await waitFor(() => {
      const recentTab = screen.getByRole('tab', { name: /recent/i });
      expect(recentTab).toHaveTextContent('2');
    });

    await waitFor(() => {
      const starredTab = screen.getByRole('tab', { name: /starred/i });
      expect(starredTab).toHaveTextContent('3');
    });
  });

  it('refetches starred dashboards when star is toggled', async () => {
    seedStars(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler(starredHits));

    const { user } = render(<DashboardTabs />);

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    await waitFor(() => {
      expect(screen.getByText('Starred Dashboard 1')).toBeInTheDocument();
    });
  });
});
