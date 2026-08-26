import { type NavModelItem, OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { dashboardVariablesAccess, dashboardsCreateAccess, playlistsAccess, snapshotsAccess } from '../pageAccess';
import { anonymousOrSignedIn, buildEntries, hasAny, isSignedIn, type NavEntryBuilder } from '../utils';

// Any org role at all grants the legacy (pre-RBAC) playlists visibility,
// as does a Grafana server admin — mirrors the inclusive c.HasRole(RoleViewer)
// check in pkg/services/navtree/navtreeimpl/navtree.go
const legacyPlaylistsAccess = () =>
  contextSrv.hasRole(OrgRole.Viewer) ||
  contextSrv.hasRole(OrgRole.Editor) ||
  contextSrv.hasRole(OrgRole.Admin) ||
  contextSrv.isGrafanaAdmin;

const DASHBOARD_CHILDREN: NavEntryBuilder[] = [
  {
    // Playlists are visible to anonymous users too, so the nav stays consistent
    // with the playlist page and API which both serve anonymous Viewers.
    //
    // playlistsRBAC is still a legacy toggle (not yet OpenFeature). The
    // multi-tenant frontend service's reduced boot ships config.featureToggles
    // empty, so this reads false there and the gate falls back to the legacy
    // role check — a known divergence pending the toggle's migration to
    // OpenFeature, after which this should read via getFeatureFlagClient().
    when: () =>
      anonymousOrSignedIn() && (config.featureToggles.playlistsRBAC ? playlistsAccess() : legacyPlaylistsAccess()),
    build: () => ({
      text: 'Playlists',
      subTitle: 'Groups of dashboards that are displayed in a sequence',
      id: 'dashboards/playlists',
      url: '/playlists',
      icon: 'presentation-play',
    }),
  },
  {
    when: () => isSignedIn() && config.snapshotEnabled && snapshotsAccess(),
    build: () => ({
      text: 'Snapshots',
      subTitle: 'Interactive, publicly available, point-in-time representations of dashboards',
      id: 'dashboards/snapshots',
      url: '/dashboard/snapshots',
      icon: 'camera',
    }),
  },
  {
    when: isSignedIn,
    build: () => ({
      text: 'Library panels',
      subTitle: 'Reusable panels that can be added to multiple dashboards',
      id: 'dashboards/library-panels',
      url: '/library-panels',
      icon: 'library-panel',
    }),
  },
  {
    when: () =>
      isSignedIn() &&
      getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardGlobalVariables, false) &&
      dashboardVariablesAccess(),
    build: () => ({
      text: 'Variables',
      subTitle: 'Template variables shared across dashboards, globally or per folder',
      id: 'dashboards/variables',
      url: '/dashboards/variables',
      icon: 'gf-variable',
    }),
  },
  {
    when: () => isSignedIn() && config.publicDashboardsEnabled,
    build: () => ({
      text: 'Public dashboards',
      id: 'dashboards/public',
      url: '/dashboard/public',
      icon: 'library-panel',
    }),
  },
  {
    when: isSignedIn,
    build: () => ({
      text: 'Recently deleted',
      subTitle: 'Any items listed here for more than 30 days will be automatically deleted.',
      id: 'dashboards/recently-deleted',
      url: '/dashboard/recently-deleted',
    }),
  },
  {
    when: dashboardsCreateAccess,
    build: () => ({
      text: 'New dashboard',
      icon: 'plus',
      url: '/dashboard/new',
      hideFromTabs: true,
      id: 'dashboards/new',
      isCreateAction: true,
    }),
  },
  {
    when: dashboardsCreateAccess,
    build: () => ({
      text: 'Import dashboard',
      subTitle: 'Import dashboard from file or Grafana.com',
      id: 'dashboards/import',
      icon: 'plus',
      url: '/dashboard/import',
      hideFromTabs: true,
      isCreateAction: true,
    }),
  },
];

export const dashboardsNavEntry: NavEntryBuilder = {
  when: () =>
    Boolean(config.publicDashboardAccessToken) ||
    hasAny(
      AccessControlAction.FoldersRead,
      AccessControlAction.FoldersCreate,
      AccessControlAction.DashboardsRead,
      AccessControlAction.DashboardsCreate
    ),
  build: (): NavModelItem => ({
    text: 'Dashboards',
    id: NavID.dashboards,
    subTitle: 'Create and manage dashboards to visualize your data',
    icon: 'apps',
    url: '/dashboards',
    sortWeight: NavWeight.dashboards,
    children: buildEntries(DASHBOARD_CHILDREN),
  }),
};
