import { http, HttpResponse } from 'msw';
import { useEffect, type ReactNode } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { DashboardTabs } from './DashboardTabs';
import { type HomepageTabExtensionProps } from './types';

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

const createDashboardTabsExtensionComponent = (
  pluginId: string,
  id: string,
  label: string,
  content: ReactNode,
  href?: string
): ComponentTypeWithExtensionMeta<{}> =>
  createComponentWithMeta(
    {
      pluginId,
      title: label,
      component: (({ register, active }: HomepageTabExtensionProps) => {
        useEffect(() => register({ id, label, href }), [register]);
        return active ? <div>{content}</div> : null;
      }) as React.ComponentType,
    },
    PluginExtensionPoints.HomepageTabs
  );

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

  it('renders extension tabs from plugins', async () => {
    const extensionComponents = [
      createDashboardTabsExtensionComponent(
        'grafana-setupguide-app',
        'tab-1',
        'Plugin Tab 1',
        <div>Content for Plugin Tab 1</div>
      ),
      createDashboardTabsExtensionComponent('grafana-setupguide-app', 'tab-2', 'Plugin Tab 2', null, '/test'),
      createDashboardTabsExtensionComponent(
        'grafana-untrusted-app',
        'tab-3',
        'Plugin Tab 3',
        <div>Content for Plugin Tab 3</div>
      ),
    ];

    setPluginComponentsHook(() => ({
      components: extensionComponents,
      isLoading: false,
    }));

    const { user } = render(<DashboardTabs />);

    expect(await screen.findByRole('tab', { name: 'Plugin Tab 1' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Plugin Tab 1' })).toHaveAttribute('aria-selected', 'true');
    });

    expect(await screen.findByRole('tab', { name: 'Plugin Tab 2' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Plugin Tab 3' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Plugin Tab 1' }));
    expect(await screen.findByText('Content for Plugin Tab 1')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Plugin Tab 2' })).toHaveAttribute('href', '/test');
  });
});
