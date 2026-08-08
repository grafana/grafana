import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { buildStaticNavTree } from './buildStaticNavTree';
import { NavID } from './constants';
import { addNavEntries, clearRegisteredNavEntries } from './registry';
import { navIds as ids, setupNavTestState as setup } from './testUtils';
import { applyAppSubUrl, findNavById as findById, pruneEmptyNavSections, sortNavTree } from './utils';

describe('buildStaticNavTree', () => {
  describe('sections', () => {
    it('builds the minimal tree for a user with no permissions', () => {
      setup();
      // Connections and cfg are attachment-parent shells here; pruneEmptyNavSections removes them
      const tree = buildStaticNavTree();

      expect(ids(tree)).toEqual([NavID.home, NavID.bookmarks, NavID.connections, NavID.cfg, NavID.profile, NavID.help]);
    });

    it('orders sections by sort weight', () => {
      setup({ permissions: ['dashboards:read', 'datasources:explore', 'alert.rules:read'] });

      expect(ids(buildStaticNavTree())).toEqual([
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
      setup({ permissions: ['dashboards:read'], config: { appSubUrl: '/grafana' } });
      const tree = applyAppSubUrl(buildStaticNavTree());

      expect(findById(tree, NavID.starred)?.url).toBe('/grafana/dashboards?starred');
      expect(findById(tree, NavID.dashboards)?.url).toBe('/grafana/dashboards');
      // Anchor-only urls (Help) are left alone
      expect(findById(tree, NavID.help)?.url).toBe('#');
    });

    it('shows global variables under dashboards with the toggle and write access', () => {
      // globalDashboardVariables is an OpenFeature flag, not a config toggle
      setTestFlags({ globalDashboardVariables: true });
      setup({ permissions: ['dashboards:read', 'dashboards:write'] });

      const children = ids(findById(buildStaticNavTree(), NavID.dashboards)?.children ?? []);
      expect(children).toContain('dashboards/variables');
      setTestFlags({});
    });
  });

  describe('dashboards section', () => {
    it('shows the section for public dashboard views without permissions', () => {
      setup({ isSignedIn: false, config: { publicDashboardAccessToken: 'abc' } });

      expect(findById(buildStaticNavTree(), NavID.dashboards)).toBeDefined();
    });

    it('builds children based on permissions and config', () => {
      setup({ permissions: ['dashboards:read', 'dashboards:create', 'snapshots:read'] });

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
      setup({ permissions: ['dashboards:read', 'snapshots:read'], config: { snapshotEnabled: false } });
      const tree = buildStaticNavTree();

      expect(findById(findById(tree, NavID.dashboards)?.children ?? [], 'dashboards/snapshots')).toBeUndefined();
    });

    it('gates playlists on the playlists RBAC permission when the toggle is on', () => {
      setup({ permissions: ['dashboards:read'], featureToggles: { playlistsRBAC: true } });
      const withoutPermission = buildStaticNavTree();

      setup({ permissions: ['dashboards:read', 'playlists:read'], featureToggles: { playlistsRBAC: true } });
      const withPermission = buildStaticNavTree();

      expect(
        findById(findById(withoutPermission, NavID.dashboards)?.children ?? [], 'dashboards/playlists')
      ).toBeUndefined();
      expect(
        findById(findById(withPermission, NavID.dashboards)?.children ?? [], 'dashboards/playlists')
      ).toBeDefined();
    });

    it('shows playlists to any org role and to server admins when the RBAC toggle is off', () => {
      const playlists = (tree: NavModelItem[]) =>
        findById(findById(tree, NavID.dashboards)?.children ?? [], 'dashboards/playlists');

      setup({ orgRole: 'Editor', permissions: ['dashboards:read'] });
      expect(playlists(buildStaticNavTree())).toBeDefined();

      setup({ orgRole: 'Admin', permissions: ['dashboards:read'] });
      expect(playlists(buildStaticNavTree())).toBeDefined();

      // A Grafana server admin passes regardless of org role, like Go's HasRole
      setup({ orgRole: 'None', isGrafanaAdmin: true, permissions: ['dashboards:read'] });
      expect(playlists(buildStaticNavTree())).toBeDefined();

      setup({ orgRole: 'None', permissions: ['dashboards:read'] });
      expect(playlists(buildStaticNavTree())).toBeUndefined();
    });
  });

  describe('alerting section', () => {
    it('is omitted when unified alerting is disabled', () => {
      setup({ permissions: ['alert.rules:read'], config: { unifiedAlertingEnabled: false } });

      expect(findById(buildStaticNavTree(), NavID.alerting)).toBeUndefined();
    });

    it('is omitted when no alerting child is accessible', () => {
      setup();
      expect(findById(buildStaticNavTree(), NavID.alerting)).toBeUndefined();
    });

    it('uses legacy ids without the V2 navigation toggle', () => {
      setup({ permissions: ['alert.rules:read', 'alert.notifications:read', 'alert.instances:read'] });

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
        permissions: ['alert.rules:read', 'alert.notifications:read', 'alert.instances:read'],
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
        permissions: ['alert.instances:read'],
        featureToggles: { alertingNavigationV2: true, alertingTriage: true },
      });

      const children = ids(findById(buildStaticNavTree(), NavID.alerting)?.children ?? []);
      expect(children).toContain('alert-activity');
      expect(children).not.toContain('groups');
    });

    it('adds admin-only items for org admins', () => {
      setup({ permissions: ['alert.rules:read'], orgRole: 'Admin' });

      expect(ids(findById(buildStaticNavTree(), NavID.alerting)?.children ?? [])).toContain('alerting-admin');
    });
  });

  describe('connections section', () => {
    it('is always present as a plugin attachment parent', () => {
      setup();
      expect(findById(buildStaticNavTree(), NavID.connections)?.children).toEqual([]);
    });

    it('adds datasource children with configuration page access', () => {
      setup({ permissions: ['datasources:read', 'datasources:write'] });

      expect(ids(findById(buildStaticNavTree(), NavID.connections)?.children ?? [])).toEqual([
        'connections-add-new-connection',
        'connections-datasources',
      ]);
    });

    it('withholds datasource children on read-only access', () => {
      setup({ permissions: ['datasources:read'] });

      expect(findById(buildStaticNavTree(), NavID.connections)?.children).toEqual([]);
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
          'orgs:read',
          'orgs:write',
          'settings:read',
          'settings:write',
          'datasources:explore',
          'org.users:read',
          'teams:create',
          'serviceaccounts:read',
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
      setup({ orgRole: 'Admin', isGrafanaAdmin: true, permissions: ['orgs:read', 'orgs:write', 'settings:read'] });
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
      setup({ permissions: ['orgs:read'], isGrafanaAdmin: false });

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

  describe('help and profile', () => {
    it('adds support bundles with config and permission', () => {
      setup({ permissions: ['support.bundles:read'], config: { supportBundlesEnabled: true } });

      expect(ids(findById(buildStaticNavTree(), NavID.help)?.children ?? [])).toEqual(['support-bundles']);
    });

    it('builds the profile node from user details', () => {
      setup();
      const profile = findById(buildStaticNavTree(), NavID.profile);

      expect(profile?.text).toBe('Test User');
      expect(profile?.subTitle).toBe('testuser');
      expect(ids(profile?.children ?? [])).toEqual(['profile/settings', 'profile/notifications', 'profile/password']);
    });

    it('omits the change password link when the login form is disabled', () => {
      setup({ config: { disableLoginForm: true } });

      expect(ids(findById(buildStaticNavTree(), NavID.profile)?.children ?? [])).not.toContain('profile/password');
    });
  });
});

describe('pruneEmptyNavSections', () => {
  it('removes empty connections, cfg/access and cfg shells like the server does', () => {
    setup();
    const tree = pruneEmptyNavSections(buildStaticNavTree());

    expect(ids(tree)).toEqual([NavID.home, NavID.bookmarks, NavID.profile, NavID.help]);
  });

  it('keeps sections that gained children', () => {
    setup({ orgRole: 'Admin', permissions: ['datasources:read', 'datasources:write', 'org.users:read'] });
    const tree = pruneEmptyNavSections(buildStaticNavTree());

    expect(ids(tree)).toContain(NavID.connections);
    expect(ids(tree)).toContain(NavID.cfg);
    const cfg = findById(tree, NavID.cfg);
    expect(ids(cfg?.children ?? [])).toContain(NavID.cfgAccess);
  });

  it('removes empty General and Plugins and data admin subsections like the server does', () => {
    // org.users:read keeps cfg/access (and so cfg) alive, while General and
    // Plugins and data have no visible children for an editor with this
    // permission set
    setup({ orgRole: 'Editor', permissions: ['org.users:read'] });
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

describe('registered nav entries', () => {
  afterEach(() => {
    clearRegisteredNavEntries();
  });

  it('appends registered items into their parent section', () => {
    setup({ orgRole: 'Admin', permissions: ['org.users:read'] });
    addNavEntries({
      parentId: NavID.cfgGeneral,
      entry: { when: () => true, build: () => ({ text: 'Announcement banner', id: 'banner-settings' }) },
    });

    const general = findById(buildStaticNavTree(), NavID.cfgGeneral);
    expect(ids(general?.children ?? [])).toContain('banner-settings');
  });

  it('appends root-level entries to the top of the tree', () => {
    setup();
    addNavEntries({
      parentId: NavID.root,
      entry: { when: () => true, build: () => ({ text: 'Enterprise thing', id: 'enterprise-thing', sortWeight: 1 }) },
    });

    expect(ids(buildStaticNavTree())).toContain('enterprise-thing');
  });

  it('respects the entry gate', () => {
    setup({ orgRole: 'Admin' });
    addNavEntries({
      parentId: NavID.cfgGeneral,
      entry: { when: () => false, build: () => ({ text: 'Hidden', id: 'hidden-entry' }) },
    });

    expect(findById(buildStaticNavTree(), 'hidden-entry')).toBeUndefined();
  });

  it('warns and skips entries whose parent does not exist', () => {
    setup();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    addNavEntries({
      parentId: 'no-such-section',
      entry: { when: () => true, build: () => ({ text: 'Orphan', id: 'orphan-entry' }) },
    });

    expect(findById(buildStaticNavTree(), 'orphan-entry')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[navtree] registered nav entry parent not found', 'no-such-section');
    warn.mockRestore();
  });
});
