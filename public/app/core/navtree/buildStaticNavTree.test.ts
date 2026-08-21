import { type NavModelItem } from '@grafana/data';
import { AccessControlAction } from 'app/types/accessControl';

import { buildStaticNavTree } from './buildStaticNavTree';
import { NavID } from './constants';
import { navIds as ids, setupNavTestState as setup } from './test-utils';
import { applyAppSubUrl, findNavById as findById, sortNavTree } from './utils';

const DASHBOARD_READER = [AccessControlAction.DashboardsRead];

describe('buildStaticNavTree', () => {
  describe('sections', () => {
    it('builds Home and Profile for a signed-in user with no permissions', () => {
      setup();

      expect(ids(buildStaticNavTree())).toEqual([NavID.home, NavID.profile]);
    });

    it('seeds Home first, then the sections a user can see', () => {
      setup({ permissions: DASHBOARD_READER });

      expect(ids(buildStaticNavTree())).toEqual([NavID.home, NavID.dashboards, NavID.profile]);
    });

    it('points home at the login page when signed out and anonymous access is disabled', () => {
      setup({ isSignedIn: false, config: { anonymousEnabled: false } });

      expect(findById(buildStaticNavTree(), NavID.home)?.url).toBe('/login');
    });

    it('prefixes urls with the app sub url', () => {
      setup({ permissions: DASHBOARD_READER, config: { appSubUrl: '/grafana' } });
      const tree = applyAppSubUrl(buildStaticNavTree());

      expect(findById(tree, NavID.dashboards)?.url).toBe('/grafana/dashboards');
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
      setup({ permissions: DASHBOARD_READER, featureToggles: { playlistsRBAC: true } });
      const withoutPermission = buildStaticNavTree();

      setup({
        permissions: [AccessControlAction.DashboardsRead, AccessControlAction.PlaylistsRead],
        featureToggles: { playlistsRBAC: true },
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

  describe('profile section', () => {
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

    it('omits the change password link when login is disabled', () => {
      setup({ config: { auth: { disableLogin: true } } });

      expect(ids(findById(buildStaticNavTree(), NavID.profile)?.children ?? [])).not.toContain('profile/password');
    });

    it('omits the profile node for anonymous users', () => {
      setup({ isSignedIn: false, config: { anonymousEnabled: true } });

      expect(findById(buildStaticNavTree(), NavID.profile)).toBeUndefined();
    });
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
