import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { buildStaticNavTree } from './buildStaticNavTree';
import { NavID } from './constants';
import { navIds as ids, setupNavTestState as setup } from './test-utils';
import { applyAppSubUrl, findNavById as findById, pruneEmptyNavSections, sortNavTree } from './utils';

const DASHBOARD_READER = [AccessControlAction.DashboardsRead];
const ALERT_RULES_READER = [AccessControlAction.AlertingRuleRead];

describe('buildStaticNavTree', () => {
  describe('sections', () => {
    it('builds the minimal tree for a user with no permissions', () => {
      setup();
      // cfg is an attachment-parent shell here; pruneEmptyNavSections removes it
      const tree = buildStaticNavTree();

      expect(ids(tree)).toEqual([NavID.home, NavID.bookmarks, NavID.cfg, NavID.profile, NavID.help]);
    });

    it('orders sections by sort weight', () => {
      setup({ permissions: [AccessControlAction.DashboardsRead, AccessControlAction.AlertingRuleRead] });

      expect(ids(buildStaticNavTree())).toEqual([
        NavID.home,
        NavID.bookmarks,
        NavID.starred,
        NavID.dashboards,
        NavID.alerting,
        NavID.cfg,
        NavID.profile,
        NavID.help,
      ]);
    });

    it('omits signed-in-only sections for anonymous users', () => {
      setup({ isSignedIn: false, config: { anonymousEnabled: true } });
      const tree = buildStaticNavTree();

      expect(findById(tree, NavID.profile)).toBeUndefined();
      expect(findById(tree, NavID.bookmarks)).toBeUndefined();
    });

    it('points home at the login page when signed out and anonymous access is disabled', () => {
      setup({ isSignedIn: false, config: { anonymousEnabled: false } });

      expect(findById(buildStaticNavTree(), NavID.home)?.url).toBe('/login');
    });

    it('prefixes urls with the app sub url', () => {
      setup({ permissions: DASHBOARD_READER, config: { appSubUrl: '/grafana' } });
      const tree = applyAppSubUrl(buildStaticNavTree());

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

      const children = ids(findById(buildStaticNavTree(), NavID.dashboards)?.children ?? []);
      expect(children).toContain('dashboards/variables');
    });
  });

  describe('dashboards section', () => {
    it('shows the section for public dashboard views without permissions', () => {
      setup({ isSignedIn: false, config: { publicDashboardAccessToken: 'abc' } });

      expect(findById(buildStaticNavTree(), NavID.dashboards)).toBeDefined();
    });

    it('builds children based on permissions and config', () => {
      setup({
        permissions: [
          AccessControlAction.DashboardsRead,
          AccessControlAction.DashboardsCreate,
          AccessControlAction.SnapshotsRead,
        ],
      });

      expect(ids(findById(buildStaticNavTree(), NavID.dashboards)?.children ?? [])).toEqual([
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
      const tree = buildStaticNavTree();

      expect(findById(findById(tree, NavID.dashboards)?.children ?? [], 'dashboards/snapshots')).toBeUndefined();
    });

    it('gates playlists on the playlists RBAC permission when the toggle is on', () => {
      // playlistsRBAC is an OpenFeature flag, not a config toggle
      setup({ permissions: DASHBOARD_READER, openFeatureFlags: { playlistsRBAC: true } });
      const withoutPermission = buildStaticNavTree();

      setup({
        permissions: [AccessControlAction.DashboardsRead, AccessControlAction.PlaylistsRead],
        openFeatureFlags: { playlistsRBAC: true },
      });
      const withPermission = buildStaticNavTree();

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

        const playlists = findById(
          findById(buildStaticNavTree(), NavID.dashboards)?.children ?? [],
          'dashboards/playlists'
        );
        expect(Boolean(playlists)).toBe(visible);
      }
    );
  });

  describe('alerting section', () => {
    it('is omitted when unified alerting is disabled', () => {
      setup({ permissions: ALERT_RULES_READER, config: { unifiedAlertingEnabled: false } });

      expect(findById(buildStaticNavTree(), NavID.alerting)).toBeUndefined();
    });

    it('shows the history item only when state history queries are served by Loki', () => {
      const history = () => findById(findById(buildStaticNavTree(), NavID.alerting)?.children ?? [], 'alerts-history');
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
      expect(findById(buildStaticNavTree(), NavID.alerting)).toBeUndefined();
    });

    it('uses legacy ids without the V2 navigation toggle', () => {
      setup({
        permissions: [
          AccessControlAction.AlertingRuleRead,
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.AlertingInstanceRead,
        ],
      });

      expect(ids(findById(buildStaticNavTree(), NavID.alerting)?.children ?? [])).toEqual([
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
        featureToggles: { alertingNavigationV2: true },
      });

      expect(ids(findById(buildStaticNavTree(), NavID.alerting)?.children ?? [])).toEqual([
        'alert-rules',
        'notification-config',
        'silences',
        'groups',
      ]);
    });

    it('hides alert groups under V2 with triage but keeps alert activity', () => {
      setup({
        permissions: [AccessControlAction.AlertingInstanceRead],
        featureToggles: { alertingNavigationV2: true, alertingTriage: true },
      });

      const children = ids(findById(buildStaticNavTree(), NavID.alerting)?.children ?? []);
      expect(children).toContain('alert-activity');
      expect(children).not.toContain('groups');
    });

    it('adds admin-only items for org admins', () => {
      setup({ permissions: ALERT_RULES_READER, orgRole: 'Admin' });

      expect(ids(findById(buildStaticNavTree(), NavID.alerting)?.children ?? [])).toContain('alerting-admin');
    });
  });

  describe('administration section', () => {
    it('always contains the subsection shells so plugin pages and enterprise items can inject into them', () => {
      setup();
      const tree = buildStaticNavTree();

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

      const cfg = findById(buildStaticNavTree(), NavID.cfg);
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

      const general = findById(findById(buildStaticNavTree(), NavID.cfg)?.children ?? [], NavID.cfgGeneral);
      expect(ids(general?.children ?? [])).toEqual(['org-settings', 'server-settings', 'global-orgs']);
    });

    it('gates provisioning on the config param, for org admins and server admins', () => {
      const provisioning = (tree: NavModelItem[]) => {
        const general = findById(findById(tree, NavID.cfg)?.children ?? [], NavID.cfgGeneral);
        return findById(general?.children ?? [], 'provisioning');
      };

      setup({ orgRole: 'Admin', config: { provisioningEnabled: true } });
      expect(provisioning(buildStaticNavTree())).toBeDefined();

      // A Grafana server admin passes regardless of org role, like Go's HasRole
      setup({ orgRole: 'Viewer', isGrafanaAdmin: true, config: { provisioningEnabled: true } });
      expect(provisioning(buildStaticNavTree())).toBeDefined();

      setup({ orgRole: 'Admin' });
      expect(provisioning(buildStaticNavTree())).toBeUndefined();
    });

    it('requires server admin for the organizations item', () => {
      setup({ permissions: [AccessControlAction.OrgsRead], isGrafanaAdmin: false });

      const general = findById(findById(buildStaticNavTree(), NavID.cfg)?.children ?? [], NavID.cfgGeneral);
      expect(findById(general?.children ?? [], 'global-orgs')).toBeUndefined();
    });

    it('shows the plugins page for org admins without plugin permissions', () => {
      setup({ orgRole: 'Admin' });

      const plugins = findById(findById(buildStaticNavTree(), NavID.cfg)?.children ?? [], NavID.cfgPlugins);
      expect(ids(plugins?.children ?? [])).toContain('plugins');
    });

    it('shows the extensions page in dev environments', () => {
      setup();
      config.buildInfo.env = 'development';

      const plugins = findById(findById(buildStaticNavTree(), NavID.cfg)?.children ?? [], NavID.cfgPlugins);
      expect(ids(plugins?.children ?? [])).toContain('extensions');
    });
  });

  describe('help', () => {
    it('adds support bundles with config and permission', () => {
      setup({ permissions: [AccessControlAction.ActionSupportBundlesRead], config: { supportBundlesEnabled: true } });

      expect(ids(findById(buildStaticNavTree(), NavID.help)?.children ?? [])).toEqual(['support-bundles']);
    });
  });
});

describe('pruneEmptyNavSections', () => {
  it('removes empty cfg/access and cfg shells like the server does', () => {
    setup();
    const tree = pruneEmptyNavSections(buildStaticNavTree());

    expect(ids(tree)).toEqual([NavID.home, NavID.bookmarks, NavID.profile, NavID.help]);
  });

  it('keeps sections that gained children', () => {
    setup({ orgRole: 'Admin', permissions: [AccessControlAction.OrgUsersRead] });
    const tree = pruneEmptyNavSections(buildStaticNavTree());

    expect(ids(tree)).toContain(NavID.cfg);
    const cfg = findById(tree, NavID.cfg);
    expect(ids(cfg?.children ?? [])).toContain(NavID.cfgAccess);
  });

  it('removes empty General and Plugins and data admin subsections like the server does', () => {
    // org.users:read keeps cfg/access (and so cfg) alive, while General and
    // Plugins and data have no visible children for an editor with this
    // permission set
    setup({ orgRole: 'Editor', permissions: [AccessControlAction.OrgUsersRead] });
    const cfg = findById(pruneEmptyNavSections(buildStaticNavTree()), NavID.cfg);

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
