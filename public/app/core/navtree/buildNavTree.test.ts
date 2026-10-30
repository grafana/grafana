import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { mockLogger } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { buildNavTree, getInitialNavTree } from './buildNavTree';
import { NavID } from './constants';
import { addNavEntries, clearRegisteredNavEntries } from './registry';
import {
  appPage,
  appPluginConfig,
  navIds as ids,
  setupNavTestApps as setupApps,
  setupNavTestState as setup,
} from './test-utils';
import { applyAppSubUrl, findNavById as findById, pruneEmptyNavSections, sortNavTree } from './utils';

const DASHBOARD_READER = [AccessControlAction.DashboardsRead];
const ALERT_RULES_READER = [AccessControlAction.AlertingRuleRead];

describe('buildNavTree', () => {
  describe('sections', () => {
    it('builds the minimal tree for a user with no permissions', () => {
      setup();
      // Connections and cfg are attachment-parent shells here; pruneEmptyNavSections removes them
      const tree = buildNavTree();

      expect(ids(tree)).toEqual([NavID.home, NavID.bookmarks, NavID.connections, NavID.cfg, NavID.profile, NavID.help]);
    });

    it('orders sections by sort weight', () => {
      setup({
        permissions: [...DASHBOARD_READER, ...ALERT_RULES_READER, AccessControlAction.DataSourcesExplore],
      });

      expect(ids(buildNavTree())).toEqual([
        NavID.home,
        NavID.bookmarks,
        NavID.starred,
        NavID.dashboards,
        NavID.explore,
        NavID.drilldown,
        NavID.alerting,
        NavID.connections,
        NavID.cfg,
        NavID.profile,
        NavID.help,
      ]);
    });

    it('places notebooks after dashboards when the flag is on and the user can read notebooks', () => {
      const notebookReader = [
        ...DASHBOARD_READER,
        AccessControlAction.NotebooksRead,
        AccessControlAction.DataSourcesExplore,
      ];
      setup({ permissions: notebookReader, openFeatureFlags: { 'dashboard.notebooks': true } });

      const treeIds = ids(buildNavTree());
      expect(treeIds.indexOf(NavID.notebooks)).toBe(treeIds.indexOf(NavID.dashboards) + 1);

      setup({ permissions: notebookReader });
      expect(findById(buildNavTree(), NavID.notebooks)).toBeUndefined();

      // Without notebooks:read there is no entry
      setup({ permissions: [], openFeatureFlags: { 'dashboard.notebooks': true } });
      expect(findById(buildNavTree(), NavID.notebooks)).toBeUndefined();
    });

    it('omits signed-in-only sections for anonymous users', () => {
      setup({ isSignedIn: false, config: { anonymousEnabled: true } });
      const tree = buildNavTree();

      expect(findById(tree, NavID.profile)).toBeUndefined();
      expect(findById(tree, NavID.bookmarks)).toBeUndefined();
    });

    it('points home at the login page when signed out and anonymous access is disabled', () => {
      setup({ isSignedIn: false, config: { anonymousEnabled: false } });

      expect(findById(buildNavTree(), NavID.home)?.url).toBe('/login');
    });

    it('prefixes urls with the app sub url', () => {
      setup({ permissions: DASHBOARD_READER, config: { appSubUrl: '/grafana' } });
      const tree = applyAppSubUrl(buildNavTree());

      expect(findById(tree, NavID.starred)?.url).toBe('/grafana/dashboards?starred');
      expect(findById(tree, NavID.dashboards)?.url).toBe('/grafana/dashboards');
      // Anchor-only urls (Help) are left alone
      expect(findById(tree, NavID.help)?.url).toBe('#');
    });

    it('shows global variables under dashboards with the toggle and write access', () => {
      // grafana.dashboardGlobalVariables is an OpenFeature flag, not a config toggle
      setup({
        permissions: [AccessControlAction.DashboardsRead, AccessControlAction.DashboardsWrite],
        openFeatureFlags: { 'grafana.dashboardGlobalVariables': true },
      });

      const children = ids(findById(buildNavTree(), NavID.dashboards)?.children ?? []);
      expect(children).toContain('dashboards/variables');
    });
  });

  describe('dashboards section', () => {
    it('shows the section for public dashboard views without permissions', () => {
      setup({ isSignedIn: false, config: { publicDashboardAccessToken: 'abc' } });

      expect(findById(buildNavTree(), NavID.dashboards)).toBeDefined();
    });

    it('builds children based on permissions and config', () => {
      setup({
        permissions: [
          AccessControlAction.DashboardsRead,
          AccessControlAction.DashboardsCreate,
          AccessControlAction.SnapshotsRead,
        ],
      });

      expect(ids(findById(buildNavTree(), NavID.dashboards)?.children ?? [])).toEqual([
        'dashboards/playlists',
        'dashboards/snapshots',
        'dashboards/library-panels',
        'dashboards/public',
        'dashboards/recently-deleted',
        'dashboards/new',
        'dashboards/import',
      ]);
    });

    it('omits snapshots when disabled in config', () => {
      setup({
        permissions: [AccessControlAction.DashboardsRead, AccessControlAction.SnapshotsRead],
        config: { snapshotEnabled: false },
      });
      const tree = buildNavTree();

      expect(findById(findById(tree, NavID.dashboards)?.children ?? [], 'dashboards/snapshots')).toBeUndefined();
    });

    it('gates playlists on the playlists RBAC permission when the toggle is on', () => {
      // playlistsRBAC is an OpenFeature flag, not a config toggle
      setup({ permissions: DASHBOARD_READER, openFeatureFlags: { playlistsRBAC: true } });
      const withoutPermission = buildNavTree();

      setup({
        permissions: [AccessControlAction.DashboardsRead, AccessControlAction.PlaylistsRead],
        openFeatureFlags: { playlistsRBAC: true },
      });
      const withPermission = buildNavTree();

      expect(
        findById(findById(withoutPermission, NavID.dashboards)?.children ?? [], 'dashboards/playlists')
      ).toBeUndefined();
      expect(
        findById(findById(withPermission, NavID.dashboards)?.children ?? [], 'dashboards/playlists')
      ).toBeDefined();
    });

    // With the RBAC toggle off, legacy visibility is any org role (Viewer+) or a
    // Grafana server admin — mirrors the inclusive c.HasRole(RoleViewer) in Go.
    it.each([
      { orgRole: 'Viewer', isGrafanaAdmin: false, visible: true },
      { orgRole: 'Editor', isGrafanaAdmin: false, visible: true },
      { orgRole: 'Admin', isGrafanaAdmin: false, visible: true },
      { orgRole: 'None', isGrafanaAdmin: true, visible: true },
      { orgRole: 'None', isGrafanaAdmin: false, visible: false },
    ] as const)(
      'shows playlists=$visible for org role $orgRole (grafanaAdmin=$isGrafanaAdmin) when the RBAC toggle is off',
      ({ orgRole, isGrafanaAdmin, visible }) => {
        setup({ orgRole, isGrafanaAdmin, permissions: DASHBOARD_READER });

        const playlists = findById(findById(buildNavTree(), NavID.dashboards)?.children ?? [], 'dashboards/playlists');
        expect(Boolean(playlists)).toBe(visible);
      }
    );
  });

  describe('alerting section', () => {
    it('is omitted when unified alerting is disabled', () => {
      setup({ permissions: ALERT_RULES_READER, config: { unifiedAlertingEnabled: false } });

      expect(findById(buildNavTree(), NavID.alerting)).toBeUndefined();
    });

    it('shows the history item only when state history queries are served by Loki', () => {
      const history = () => findById(findById(buildNavTree(), NavID.alerting)?.children ?? [], 'alerts-history');
      const withStateHistory = (stateHistory?: { backend?: string; primary?: string }) => {
        setup({ permissions: ALERT_RULES_READER });
        config.unifiedAlerting = { ...config.unifiedAlerting, stateHistory };
      };

      withStateHistory({ backend: 'loki' });
      expect(history()).toBeDefined();

      withStateHistory({ backend: 'multiple', primary: 'loki' });
      expect(history()).toBeDefined();

      withStateHistory({ backend: 'multiple', primary: 'annotations' });
      expect(history()).toBeUndefined();

      withStateHistory({ backend: 'annotations' });
      expect(history()).toBeUndefined();

      withStateHistory(undefined);
      expect(history()).toBeUndefined();
    });

    it('is omitted when no alerting child is accessible', () => {
      setup();
      expect(findById(buildNavTree(), NavID.alerting)).toBeUndefined();
    });

    it('uses legacy ids without the V2 navigation toggle', () => {
      setup({
        permissions: [
          AccessControlAction.AlertingRuleRead,
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.AlertingInstanceRead,
        ],
        // The toggle is on by default, so the legacy shape has to be asked for
        openFeatureFlags: { alertingNavigationV2: false },
      });

      expect(ids(findById(buildNavTree(), NavID.alerting)?.children ?? [])).toEqual([
        'alert-list',
        'receivers',
        'am-routes',
        'silences',
        'groups',
      ]);
    });

    it('groups notification items and renames rules under V2 navigation', () => {
      setup({
        permissions: [
          AccessControlAction.AlertingRuleRead,
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.AlertingInstanceRead,
        ],
        openFeatureFlags: { alertingNavigationV2: true },
      });

      expect(ids(findById(buildNavTree(), NavID.alerting)?.children ?? [])).toEqual([
        'alert-rules',
        'notification-config',
        'silences',
        'groups',
      ]);
    });

    it('moves alert groups into alert activity under V2 when state history writes to Prometheus', () => {
      const alertingChildren = (openFeatureFlags: Record<string, boolean>) => {
        setup({
          permissions: [AccessControlAction.AlertingInstanceRead],
          openFeatureFlags: { alertingNavigationV2: true, ...openFeatureFlags },
          config: {
            unifiedAlerting: {
              ...config.unifiedAlerting,
              stateHistory: { backend: 'prometheus', prometheusTargetDatasourceUID: 'prom-uid' },
            },
          },
        });
        return ids(findById(buildNavTree(), NavID.alerting)?.children ?? []);
      };

      const children = alertingChildren({});
      expect(children).toContain('alert-activity');
      expect(children).not.toContain('groups');

      // The flag can still turn the page off
      const childrenWithFlagOff = alertingChildren({ alertingTriage: false });
      expect(childrenWithFlagOff).not.toContain('alert-activity');
      expect(childrenWithFlagOff).toContain('groups');

      config.unifiedAlerting = { ...config.unifiedAlerting, stateHistory: undefined };
    });

    it('adds admin-only items for org admins', () => {
      setup({ permissions: ALERT_RULES_READER, orgRole: 'Admin' });

      expect(ids(findById(buildNavTree(), NavID.alerting)?.children ?? [])).toContain('alerting-admin');
    });
  });

  describe('connections section', () => {
    it('is always present as a plugin attachment parent', () => {
      setup();
      expect(findById(buildNavTree(), NavID.connections)?.children).toEqual([]);
    });

    it('adds datasource children with configuration page access', () => {
      setup({ permissions: [AccessControlAction.DataSourcesRead, AccessControlAction.DataSourcesWrite] });

      expect(ids(findById(buildNavTree(), NavID.connections)?.children ?? [])).toEqual([
        'connections-add-new-connection',
        'connections-datasources',
      ]);
    });

    it('withholds datasource children on read-only access', () => {
      setup({ permissions: [AccessControlAction.DataSourcesRead] });

      expect(findById(buildNavTree(), NavID.connections)?.children).toEqual([]);
    });
  });

  describe('administration section', () => {
    it('always contains the subsection shells so plugin pages and enterprise items can inject into them', () => {
      setup();
      const tree = buildNavTree();

      expect(findById(tree, NavID.cfg)).toBeDefined();
      expect(ids(findById(tree, NavID.cfg)?.children ?? [])).toEqual([
        NavID.cfgGeneral,
        NavID.cfgPlugins,
        NavID.cfgAccess,
      ]);
    });

    it('builds general, plugins, access and authentication nodes for an admin', () => {
      setup({
        orgRole: 'Admin',
        isGrafanaAdmin: true,
        permissions: [
          AccessControlAction.OrgsRead,
          AccessControlAction.OrgsWrite,
          AccessControlAction.SettingsRead,
          AccessControlAction.SettingsWrite,
          AccessControlAction.DataSourcesExplore,
          AccessControlAction.OrgUsersRead,
          AccessControlAction.ActionTeamsCreate,
          AccessControlAction.ServiceAccountsRead,
        ],
      });

      const cfg = findById(buildNavTree(), NavID.cfg);
      expect(ids(cfg?.children ?? [])).toEqual([NavID.cfgGeneral, NavID.cfgPlugins, NavID.cfgAccess, 'authentication']);
      expect(ids(findById(cfg?.children ?? [], NavID.cfgGeneral)?.children ?? [])).toEqual([
        'upgrading',
        'org-settings',
        'server-settings',
        'global-orgs',
      ]);
      expect(ids(findById(cfg?.children ?? [], NavID.cfgAccess)?.children ?? [])).toEqual([
        'global-users',
        'teams',
        'serviceaccounts',
      ]);
      expect(cfg?.subTitle).toBe('Organization: Main Org.');
    });

    it('hides the stats and license item on enterprise builds, where enterprise registers its own', () => {
      setup({
        orgRole: 'Admin',
        isGrafanaAdmin: true,
        permissions: [AccessControlAction.OrgsRead, AccessControlAction.OrgsWrite, AccessControlAction.SettingsRead],
      });
      config.buildInfo = { ...config.buildInfo, edition: GrafanaEdition.Enterprise };

      const general = findById(findById(buildNavTree(), NavID.cfg)?.children ?? [], NavID.cfgGeneral);
      expect(ids(general?.children ?? [])).toEqual(['org-settings', 'server-settings', 'global-orgs']);
    });

    it('gates provisioning on the config param, for org admins and server admins', () => {
      const provisioning = (tree: NavModelItem[]) => {
        const general = findById(findById(tree, NavID.cfg)?.children ?? [], NavID.cfgGeneral);
        return findById(general?.children ?? [], 'provisioning');
      };

      setup({ orgRole: 'Admin', config: { provisioningEnabled: true } });
      expect(provisioning(buildNavTree())).toBeDefined();

      // A Grafana server admin passes regardless of org role, like Go's HasRole
      setup({ orgRole: 'Viewer', isGrafanaAdmin: true, config: { provisioningEnabled: true } });
      expect(provisioning(buildNavTree())).toBeDefined();

      setup({ orgRole: 'Admin' });
      expect(provisioning(buildNavTree())).toBeUndefined();
    });

    it('requires server admin for the organizations item', () => {
      setup({ permissions: [AccessControlAction.OrgsRead], isGrafanaAdmin: false });

      const general = findById(findById(buildNavTree(), NavID.cfg)?.children ?? [], NavID.cfgGeneral);
      expect(findById(general?.children ?? [], 'global-orgs')).toBeUndefined();
    });

    it('shows the plugins page for org admins without plugin permissions', () => {
      setup({ orgRole: 'Admin' });

      const plugins = findById(findById(buildNavTree(), NavID.cfg)?.children ?? [], NavID.cfgPlugins);
      expect(ids(plugins?.children ?? [])).toContain('plugins');
    });

    it('shows the extensions page in dev environments', () => {
      setup();
      config.buildInfo.env = 'development';

      const plugins = findById(findById(buildNavTree(), NavID.cfg)?.children ?? [], NavID.cfgPlugins);
      expect(ids(plugins?.children ?? [])).toContain('extensions');
    });

    it('shows the extensions page outside dev only with the toggle and plugin write access', () => {
      const pluginsPageChildren = () =>
        ids(findById(findById(buildNavTree(), NavID.cfg)?.children ?? [], NavID.cfgPlugins)?.children ?? []);

      setup({ permissions: [AccessControlAction.PluginsWrite] });
      expect(pluginsPageChildren()).not.toContain('extensions');

      setup({ openFeatureFlags: { enableExtensionsAdminPage: true } });
      expect(pluginsPageChildren()).not.toContain('extensions');

      setup({
        permissions: [AccessControlAction.PluginsWrite],
        openFeatureFlags: { enableExtensionsAdminPage: true },
      });
      expect(pluginsPageChildren()).toContain('extensions');
    });
  });

  describe('help', () => {
    it('adds support bundles with config and permission', () => {
      setup({ permissions: [AccessControlAction.ActionSupportBundlesRead], config: { supportBundlesEnabled: true } });

      expect(ids(findById(buildNavTree(), NavID.help)?.children ?? [])).toEqual(['support-bundles']);
    });
  });
});

describe('pruneEmptyNavSections', () => {
  it('removes empty connections, cfg/access and cfg shells like the server does', () => {
    setup();
    const tree = pruneEmptyNavSections(buildNavTree());

    expect(ids(tree)).toEqual([NavID.home, NavID.bookmarks, NavID.profile, NavID.help]);
  });

  // Drilldown's children are the drilldown apps, so with none attached the
  // server drops the section (RemoveEmptyDrilldownSection) rather than leaving
  // a top-level item that opens an empty landing page.
  it('removes the drilldown shell when no drilldown apps attached', () => {
    setup({ permissions: [AccessControlAction.DataSourcesExplore] });
    const tree = pruneEmptyNavSections(buildNavTree());

    expect(findById(buildNavTree(), NavID.drilldown)).toBeDefined();
    expect(findById(tree, NavID.drilldown)).toBeUndefined();
    // Explore is a leaf, not an attachment shell, so it survives
    expect(findById(tree, NavID.explore)).toBeDefined();
  });

  // More apps is created on demand, so it is only empty when an override has
  // moved its last app elsewhere — maintenance windows, nested under SLO
  it('removes an emptied More apps section but keeps a populated one', () => {
    setup();
    const empty: NavModelItem[] = [{ id: NavID.apps, text: 'More apps', url: '/apps', children: [] }];
    const populated: NavModelItem[] = [
      { id: NavID.apps, text: 'More apps', url: '/apps', children: [{ id: 'plugin-page-some-app', text: 'Some app' }] },
    ];

    expect(findById(pruneEmptyNavSections(empty), NavID.apps)).toBeUndefined();
    expect(findById(pruneEmptyNavSections(populated), NavID.apps)).toBeDefined();
  });

  it('keeps sections that gained children', () => {
    setup({
      orgRole: 'Admin',
      permissions: [
        AccessControlAction.DataSourcesRead,
        AccessControlAction.DataSourcesWrite,
        AccessControlAction.OrgUsersRead,
      ],
    });
    const tree = pruneEmptyNavSections(buildNavTree());

    expect(ids(tree)).toContain(NavID.connections);
    expect(ids(tree)).toContain(NavID.cfg);
    const cfg = findById(tree, NavID.cfg);
    expect(ids(cfg?.children ?? [])).toContain(NavID.cfgAccess);
  });

  it('removes empty General and Plugins and data admin subsections like the server does', () => {
    // org.users:read keeps cfg/access (and so cfg) alive, while General and
    // Plugins and data have no visible children for an editor with this
    // permission set
    setup({ orgRole: 'Editor', permissions: [AccessControlAction.OrgUsersRead] });
    const cfg = findById(pruneEmptyNavSections(buildNavTree()), NavID.cfg);

    expect(cfg).toBeDefined();
    expect(ids(cfg?.children ?? [])).not.toContain(NavID.cfgGeneral);
    expect(ids(cfg?.children ?? [])).not.toContain(NavID.cfgPlugins);
    expect(ids(cfg?.children ?? [])).toContain(NavID.cfgAccess);
  });
});

describe('sortNavTree', () => {
  it('sorts by weight with insertion-order fallback for unweighted items, without mutating the input', () => {
    const nodes: NavModelItem[] = [
      { id: 'c', text: 'C' },
      { id: 'a', text: 'A', sortWeight: -100 },
      { id: 'd', text: 'D' },
      { id: 'b', text: 'B', sortWeight: -50 },
    ];

    const sorted = sortNavTree(nodes);

    expect(ids(sorted)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(nodes)).toEqual(['c', 'a', 'd', 'b']);
  });
});

describe('registered nav entries', () => {
  afterEach(() => {
    clearRegisteredNavEntries();
  });

  it('appends registered items into their parent section', () => {
    setup({ orgRole: 'Admin', permissions: [AccessControlAction.OrgUsersRead] });
    addNavEntries({
      parentId: NavID.cfgGeneral,
      entry: { build: () => ({ text: 'Announcement banner', id: 'banner-settings' }) },
    });

    const general = findById(buildNavTree(), NavID.cfgGeneral);
    expect(ids(general?.children ?? [])).toContain('banner-settings');
  });

  it('appends root-level entries to the top of the tree', () => {
    setup();
    addNavEntries({
      parentId: NavID.root,
      entry: { build: () => ({ text: 'Enterprise thing', id: 'enterprise-thing', sortWeight: 1 }) },
    });

    expect(ids(buildNavTree())).toContain('enterprise-thing');
  });

  it('respects the entry gate', () => {
    setup({ orgRole: 'Admin' });
    addNavEntries({
      parentId: NavID.cfgGeneral,
      entry: { when: () => false, build: () => ({ text: 'Hidden', id: 'hidden-entry' }) },
    });

    expect(findById(buildNavTree(), 'hidden-entry')).toBeUndefined();
  });

  it('warns and skips entries whose parent does not exist', () => {
    setup();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    addNavEntries({
      parentId: 'no-such-section',
      entry: { build: () => ({ text: 'Orphan', id: 'orphan-entry' }) },
    });

    expect(findById(buildNavTree(), 'orphan-entry')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[navtree] registered nav entry parent not found', 'no-such-section');
    warn.mockRestore();
  });

  // The gates run inside configureStore, so an entry that throws must not take
  // the rest of the tree — and navIndex — down with it
  it('drops an entry whose gate throws and keeps the rest of the tree', () => {
    setup({ permissions: DASHBOARD_READER });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    addNavEntries({
      parentId: NavID.dashboards,
      entry: {
        when: () => {
          throw new Error('missing config');
        },
        build: () => ({ text: 'Exploding', id: 'exploding-entry' }),
      },
    });

    const tree = buildNavTree();

    expect(findById(tree, 'exploding-entry')).toBeUndefined();
    expect(findById(tree, NavID.dashboards)).toBeDefined();
    expect(findById(tree, NavID.home)).toBeDefined();
    expect(error).toHaveBeenCalledWith('[navtree] nav entry failed to build', expect.any(Error));
    error.mockRestore();
  });
});

describe('getInitialNavTree', () => {
  // The plugin merge is the other place that prunes, and it needs
  // plugins.useMTPlugins on top of the client-build flag. With that off it never
  // runs, so the tree this returns is the one the user gets.
  const clientBuildOnly = { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': false };

  it('prunes the connections and administration shells when the plugin merge is disabled', () => {
    setup({ openFeatureFlags: clientBuildOnly });

    const tree = getInitialNavTree();

    expect(findById(tree, NavID.connections)).toBeUndefined();
    expect(findById(tree, NavID.cfg)).toBeUndefined();
  });

  // Drilldown is filled only by drilldown app plugins, so with the merge off it
  // is always empty — and it takes the same permission that makes Explore (and
  // Correlations, which keeps Administration alive) visible
  it('prunes the drilldown shell when the plugin merge is disabled', () => {
    setup({ permissions: [AccessControlAction.DataSourcesExplore], openFeatureFlags: clientBuildOnly });

    const tree = getInitialNavTree();

    expect(findById(tree, NavID.drilldown)).toBeUndefined();
    expect(findById(tree, NavID.explore)).toBeDefined();
  });

  it('returns the bootdata tree when the client build is off', () => {
    setup();
    config.bootData = { ...config.bootData, navTree: [{ id: 'server-built', text: 'Server built' }] };

    expect(ids(getInitialNavTree())).toEqual(['server-built']);
  });

  // The transitional tweaks are the one stage both trees share, which is what
  // lets a tweak land for everyone during the client-build rollout
  it('applies the nav tweaks to the bootdata tree as well', () => {
    setup({ openFeatureFlags: { 'grafana.navigationInfoArchRefresh': true } });
    config.bootData = {
      ...config.bootData,
      navTree: [
        { id: 'plugin-page-grafana-ml-app', text: 'Machine Learning', url: '/a/grafana-ml-app' },
        { id: NavID.apps, text: 'More apps', url: '/apps', children: [] },
      ],
    };

    const tree = getInitialNavTree();

    expect(ids(tree)).toEqual([NavID.apps]);
    expect(ids(findById(tree, NavID.apps)?.children ?? [])).toEqual(['plugin-page-grafana-ml-app']);
  });

  // More apps is built only once an app lands in it, and the empty shell is
  // pruned before the tweaks run, so the section a tweak targets may be absent
  it('creates the target section when the tweak finds none', () => {
    setup({ openFeatureFlags: { 'grafana.navigationInfoArchRefresh': true } });
    config.bootData = {
      ...config.bootData,
      navTree: [{ id: 'plugin-page-grafana-ml-app', text: 'Machine Learning', url: '/a/grafana-ml-app' }],
    };

    const tree = getInitialNavTree();

    expect(ids(tree)).toEqual([NavID.apps]);
    expect(ids(findById(tree, NavID.apps)?.children ?? [])).toEqual(['plugin-page-grafana-ml-app']);
  });

  it('leaves the tree alone when the tweak has nothing to move', () => {
    setup({ openFeatureFlags: { 'grafana.navigationInfoArchRefresh': true } });
    config.bootData = { ...config.bootData, navTree: [{ id: 'home', text: 'Home' }] };

    expect(ids(getInitialNavTree())).toEqual(['home']);
  });

  // The tweaks run after applyAppSubUrl, and the server-built tree arrives
  // prefixed, so a section a tweak creates has to carry the prefix itself
  it('applies the app sub url to a section the tweak creates', () => {
    setup({
      openFeatureFlags: { 'grafana.navigationInfoArchRefresh': true },
      config: { appSubUrl: '/grafana' },
    });
    config.bootData = {
      ...config.bootData,
      navTree: [{ id: 'plugin-page-grafana-ml-app', text: 'Machine Learning', url: '/grafana/a/grafana-ml-app' }],
    };

    expect(findById(getInitialNavTree(), NavID.apps)?.url).toBe('/grafana/apps');
  });

  describe('administration section nav regrouping', () => {
    const administration = (): NavModelItem[] => [
      {
        id: NavID.cfg,
        text: 'Administration',
        url: '/admin',
        children: [
          { id: 'plugin-page-grafana-advisor-app', text: 'Advisor', url: '/a/grafana-advisor-app/home' },
          { id: 'secrets-management', text: 'Secrets Management', url: '/admin/secrets' },
          {
            id: NavID.cfgGeneral,
            text: 'General',
            url: '/admin/general',
            children: [
              { id: 'upgrading', text: 'Stats and license', url: '/admin/upgrading', sortWeight: -1 },
              { id: 'org-settings', text: 'Default preferences', url: '/org' },
              { id: 'server-settings', text: 'Settings', url: '/admin/settings' },
              { id: 'migrate-to-cloud', text: 'Migrate to Grafana Cloud', url: '/admin/migrate-to-cloud' },
              { id: 'provisioning', text: 'Provisioning', url: '/admin/provisioning' },
            ],
          },
          { id: 'authentication', text: 'Authentication', url: '/admin/authentication' },
          {
            id: NavID.cfgAccess,
            text: 'Users and access',
            url: '/admin/access',
            children: [{ id: 'serviceaccounts', text: 'Service accounts', url: '/org/serviceaccounts' }],
          },
        ],
      },
    ];

    const withBootdata = (navTree: NavModelItem[], flagOn = true) => {
      setup({ openFeatureFlags: { 'grafana.navigationAdminSubNav': flagOn } });
      config.bootData = { ...config.bootData, navTree };
    };

    it('puts Authentication, Advisor and Secrets Management at the end of General, in that order', () => {
      withBootdata(administration());

      const cfg = findById(getInitialNavTree(), NavID.cfg);

      expect(ids(cfg?.children ?? [])).toEqual([NavID.cfgGeneral, NavID.cfgAccess]);
      expect(ids(findById(getInitialNavTree(), NavID.cfgAccess)?.children ?? [])).toEqual(['serviceaccounts']);
      expect(ids(findById(getInitialNavTree(), NavID.cfgGeneral)?.children ?? [])).toEqual([
        'org-settings',
        'migrate-to-cloud',
        'provisioning',
        'upgrading',
        'server-settings',
        'authentication',
        'plugin-page-grafana-advisor-app',
        'secrets-management',
      ]);
    });

    it('sends Administration and General to Default preferences, as the landing', () => {
      withBootdata(administration());

      const tree = getInitialNavTree();

      expect(findById(tree, NavID.cfg)?.url).toBe('/org');
      expect(findById(tree, NavID.cfgGeneral)?.url).toBe('/org');
    });

    it('gives the regrouped destinations the icons of the design', () => {
      const tree = administration();
      tree[0].children = tree[0].children?.map((child) =>
        child.id === 'authentication' ? { ...child, icon: 'shield' } : child
      );
      withBootdata(tree);

      const icon = (id: string) => findById(getInitialNavTree(), id)?.icon;

      expect(icon('migrate-to-cloud')).toBe('cloud-upload');
      expect(icon('provisioning')).toBe('code-branch');
      expect(icon('authentication')).toBe('key-skeleton-alt');
      expect(icon('plugin-page-grafana-advisor-app')).toBe('heart');
      expect(icon('secrets-management')).toBe('lock');
    });

    it('keeps an icon a destination already has', () => {
      const tree = administration();
      const general = tree[0].children?.find((child) => child.id === NavID.cfgGeneral);
      general!.children = general!.children?.map((child) =>
        child.id === 'provisioning' ? { ...child, icon: 'cog' } : child
      );
      withBootdata(tree);

      expect(findById(getInitialNavTree(), 'provisioning')?.icon).toBe('cog');
    });

    it('leaves General out of the breadcrumbs, and nothing else', () => {
      withBootdata(administration());

      const tree = getInitialNavTree();

      expect(findById(tree, NavID.cfgGeneral)?.hideFromBreadcrumbs).toBe(true);
      expect(findById(tree, NavID.cfg)?.hideFromBreadcrumbs).toBeUndefined();
      expect(findById(tree, NavID.cfgAccess)?.hideFromBreadcrumbs).toBeUndefined();
    });

    it('keeps the Administration landing when there is no Default preferences', () => {
      const tree = administration();
      const general = tree[0].children?.find((child) => child.id === NavID.cfgGeneral);
      general!.children = general!.children?.filter((child) => child.id !== 'org-settings');
      withBootdata(tree);

      expect(findById(getInitialNavTree(), NavID.cfg)?.url).toBe('/admin');
    });

    it('keeps them at the end even when they arrive with a weight of their own', () => {
      const tree = administration();
      tree[0].children = tree[0].children?.map((child) =>
        child.id === 'secrets-management' ? { ...child, sortWeight: -900 } : child
      );
      withBootdata(tree);

      expect(ids(findById(getInitialNavTree(), NavID.cfgGeneral)?.children ?? []).slice(-2)).toEqual([
        'plugin-page-grafana-advisor-app',
        'secrets-management',
      ]);
    });

    it('leaves the tree as it was when the flag is off', () => {
      withBootdata(administration(), false);

      expect(getInitialNavTree()).toEqual(administration());
    });

    it('moves the one that is there when the other is missing', () => {
      const tree = administration();
      tree[0].children = tree[0].children?.filter((child) => child.id !== 'secrets-management');
      withBootdata(tree);

      expect(ids(findById(getInitialNavTree(), NavID.cfgGeneral)?.children ?? []).slice(-1)).toEqual([
        'plugin-page-grafana-advisor-app',
      ]);
    });

    it('leaves the tree as it was when the groups are missing', () => {
      const tree = administration();
      tree[0].children = tree[0].children?.filter(
        (child) => child.id !== NavID.cfgGeneral && child.id !== NavID.cfgAccess
      );
      const expected = structuredClone(tree);
      withBootdata(tree);

      expect(getInitialNavTree()).toEqual(expected);
    });

    it('applies to the client-built tree too', () => {
      setup({
        permissions: [AccessControlAction.SettingsRead],
        openFeatureFlags: { 'grafana.multiTenantNavTree': true, 'grafana.navigationAdminSubNav': true },
      });
      addNavEntries({
        parentId: NavID.cfg,
        entry: { build: () => ({ id: 'secrets-management', text: 'Secrets Management', url: '/admin/secrets' }) },
      });

      const tree = getInitialNavTree();

      expect(findById(findById(tree, NavID.cfgGeneral)?.children ?? [], 'secrets-management')).toBeDefined();
      expect(ids(findById(tree, NavID.cfg)?.children ?? [])).not.toContain('secrets-management');
    });
  });

  // The apps section reads the app metas synchronously: app.ts fills the cache
  // and fetches the user's permissions before the store is configured, and this
  // is where both land in the tree.
  describe('apps section', () => {
    const bothFlags = { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true };
    const appWithPage = (id: string, name: string) =>
      appPluginConfig(id, name, [appPage('Overview', `/a/${id}/overview`)]);
    const someApp = appWithPage('some-app', 'Some app');

    afterEach(() => {
      setupApps();
    });

    it('builds More apps from the app metas in the cache', () => {
      setup({ permissions: [AccessControlAction.PluginsAppAccess], openFeatureFlags: bothFlags });
      setupApps([someApp]);

      const apps = findById(getInitialNavTree(), NavID.apps);

      expect(apps?.text).toBe('More apps');
      expect(ids(apps?.children ?? [])).toEqual(['plugin-page-some-app']);
    });

    it('omits the section when the plugin nav is disabled', () => {
      setup({ permissions: [AccessControlAction.PluginsAppAccess], openFeatureFlags: clientBuildOnly });
      setupApps([someApp]);

      expect(findById(getInitialNavTree(), NavID.apps)).toBeUndefined();
    });

    // In a fully multi-tenant deployment the permissions come from the AuthZ API
    // rather than bootdata, so a user without app access must get no plugin items
    it('omits the section for a user without app access', () => {
      setup({ openFeatureFlags: bothFlags });
      setupApps([someApp]);

      expect(findById(getInitialNavTree(), NavID.apps)).toBeUndefined();
    });

    // The section is built every time and pruned when empty, where the server
    // builds it only once it has an app to put in it. Same end state.
    it('prunes the section when no app has nav children', () => {
      setup({ permissions: [AccessControlAction.PluginsAppAccess], openFeatureFlags: bothFlags });
      setupApps([
        appPluginConfig('hidden-app', 'Hidden app', [appPage('Hidden', '/a/hidden-app', { addToNav: false })]),
      ]);

      expect(findById(getInitialNavTree(), NavID.apps)).toBeUndefined();
    });

    it('prunes the empty shells but keeps the apps section', () => {
      setup({ permissions: [AccessControlAction.PluginsAppAccess], openFeatureFlags: bothFlags });
      setupApps([someApp]);

      const tree = getInitialNavTree();

      expect(findById(tree, NavID.connections)).toBeUndefined();
      expect(findById(tree, NavID.apps)).toBeDefined();
    });

    // The builder returns sub-url relative urls and getInitialNavTree applies the
    // prefix, so a node the builder created must come out prefixed exactly once
    it('applies the app sub url once to the apps section', () => {
      setup({
        permissions: [AccessControlAction.PluginsAppAccess],
        openFeatureFlags: bothFlags,
        config: { appSubUrl: '/grafana' },
      });
      setupApps([someApp]);

      expect(findById(getInitialNavTree(), NavID.apps)?.url).toBe('/grafana/apps');
    });

    // app.ts skips the metas fetch without a session, so the tree must not then
    // read a cache nobody filled: the sync getter logs an error when it has never
    // been initialised, and the tree is built once per nav slice
    it('does not read the metas cache on a signed-out boot', () => {
      const logger = mockLogger('grafana/runtime.plugins.meta');
      setup({
        permissions: [AccessControlAction.PluginsAppAccess],
        openFeatureFlags: bothFlags,
        orgRole: '',
      });
      setupApps();

      expect(findById(getInitialNavTree(), NavID.apps)).toBeUndefined();
      expect(logger.logError).not.toHaveBeenCalled();
    });

    // Drilldown is prunable and is filled only by drilldown apps, so an app
    // attaching to it is what keeps the section alive
    it('keeps the drilldown shell once a drilldown app attaches to it', () => {
      setup({
        permissions: [AccessControlAction.PluginsAppAccess, AccessControlAction.DataSourcesExplore],
        openFeatureFlags: bothFlags,
      });
      setupApps([appWithPage('grafana-metricsdrilldown-app', 'Metrics')]);

      expect(findById(getInitialNavTree(), NavID.drilldown)?.children?.length).toBe(1);
    });

    // sortNavTree recurses into the section, and only leaves its order alone
    // because every app link carries the same weight
    it('keeps the apps in title order through the whole pipeline', () => {
      setup({ permissions: [AccessControlAction.PluginsAppAccess], openFeatureFlags: bothFlags });
      setupApps([appWithPage('c-app', 'Charlie'), appWithPage('a-app', 'Alpha'), appWithPage('b-app', 'Bravo')]);

      const apps = findById(getInitialNavTree(), NavID.apps);

      expect((apps?.children ?? []).map((child) => child.text)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });
  });
});
