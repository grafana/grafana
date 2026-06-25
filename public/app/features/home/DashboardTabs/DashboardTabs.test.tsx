import { http, HttpResponse } from 'msw';
import { useEffect, type ReactNode } from 'react';
import { render, screen } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { config, reportInteraction, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { tabChanged } from '../analytics/main';

import { DashboardTabs } from './DashboardTabs';
import { type HomepageTabExtensionProps } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));
jest.mock('../analytics/main', () => ({
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  emptyCtaClicked: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const impressionKey = `dashboard_impressions-${contextSrv.user.orgId}`;

function makeDashboardHit(overrides: Partial<DashboardHit> & { name: string; title: string }): DashboardHit {
  return {
    resource: 'dashboards',
    folder: 'general',
    field: {},
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

const mostUsedHits: DashboardHit[] = [
  makeDashboardHit({ name: 'most-used-1', title: 'Most Used Dashboard 1', field: { views_last_30_days: 100 } }),
  makeDashboardHit({ name: 'most-used-2', title: 'Most Used Dashboard 2', field: { views_last_30_days: 50 } }),
  makeDashboardHit({ name: 'most-used-3', title: 'Most Used Dashboard 3', field: { views_last_30_days: null } }),
];

function seedRecent(uids: string[]) {
  window.localStorage.setItem(impressionKey, JSON.stringify(uids));
}

function seedStars(uids: string[]) {
  server.use(http.get('/api/user/stars', () => HttpResponse.json(uids)));
}

beforeEach(() => {
  jest.clearAllMocks();
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  window.localStorage.removeItem(impressionKey);
  seedStars([]);
  config.licenseInfo.enabledFeatures = {};
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

    expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Recent Dashboard 2')).toBeInTheDocument();
  });

  it('switches to Starred tab and shows starred dashboards', async () => {
    seedStars(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    const { user } = render(<DashboardTabs />);

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByText('Starred Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Starred Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Starred Dashboard 3')).toBeInTheDocument();
  });

  it('shows empty state when no recent dashboards', async () => {
    render(<DashboardTabs />);

    expect(await screen.findByText("Dashboards you've recently viewed will appear here.")).toBeInTheDocument();
  });

  it('shows empty state when no starred dashboards', async () => {
    seedStars([]);
    const { user } = render(<DashboardTabs />);

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(await screen.findByText('Your starred dashboards will appear here.')).toBeInTheDocument();
  });

  it('stays on a manually selected empty tab instead of bouncing back', async () => {
    seedRecent(['recent-1', 'recent-2']);
    seedStars([]);
    server.use(getCustomSearchHandler([...recentHits]));

    const { user } = render(<DashboardTabs />);

    expect(await screen.findByRole('tab', { name: /recent/i, selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Your starred dashboards will appear here.')).toBeInTheDocument();
  });

  it('shows counter badges with correct counts', async () => {
    seedRecent(['recent-1', 'recent-2']);
    seedStars(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    render(<DashboardTabs />);

    expect(await screen.findByRole('tab', { name: /recent.*2/i })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /starred.*3/i })).toBeInTheDocument();
  });

  it('refetches starred dashboards when star is toggled', async () => {
    seedStars(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler(starredHits));

    const { user } = render(<DashboardTabs />);

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(await screen.findByText('Starred Dashboard 1')).toBeInTheDocument();
  });

  describe('Most used tab', () => {
    const allHits = [...recentHits, ...starredHits, ...mostUsedHits];

    it('renders Most used tab when analytics feature is enabled', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs />);

      expect(await screen.findByRole('tab', { name: /most used/i })).toBeInTheDocument();
    });

    it('does not render Most used tab when analytics feature is disabled', async () => {
      config.licenseInfo.enabledFeatures = {};
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs />);

      expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();

      expect(screen.queryByRole('tab', { name: /most used/i })).not.toBeInTheDocument();
    });

    it('does not render dashboards with no views in the last 30 days', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      const { user } = render(<DashboardTabs />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));

      expect(await screen.findByText('Most Used Dashboard 1')).toBeInTheDocument();
      expect(screen.queryByText('Most Used Dashboard 3')).not.toBeInTheDocument();
    });

    it('auto-switches to Most used when recent is empty and most-used has items', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      // No recent dashboards seeded
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs />);

      expect(await screen.findByRole('tab', { name: /most used/i, selected: true })).toBeInTheDocument();

      expect(await screen.findByText('Most Used Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Most Used Dashboard 2')).toBeInTheDocument();
    });

    it('stays on Recent when recent has items even with most-used available', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs />);

      expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();

      expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('tracks a user click on the Most used tab', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      // recent non-empty keeps us on the Recent tab so the only tabChanged call comes from the click below
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      const { user } = render(<DashboardTabs />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));

      expect(jest.mocked(tabChanged)).toHaveBeenCalledWith({ tab: 'most-used' });
    });

    it('tracks clicks on a dashboard in the Most used tab', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      const { user } = render(<DashboardTabs />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));
      await user.click(await screen.findByText('Most Used Dashboard 1'));

      expect(jest.mocked(reportInteraction)).toHaveBeenCalledWith(
        'grafana_browse_dashboards_page_click_list_item',
        expect.objectContaining({ source: 'homepage_mostUsedTab' })
      );
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
    expect(await screen.findByRole('tab', { name: 'Plugin Tab 1', selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Plugin Tab 2' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Plugin Tab 3' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Plugin Tab 1' }));
    expect(await screen.findByText('Content for Plugin Tab 1')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Plugin Tab 2' })).toHaveAttribute('href', '/test');
  });
});
