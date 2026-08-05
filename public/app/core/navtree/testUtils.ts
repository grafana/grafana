import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

export interface NavTestState {
  permissions?: string[];
  orgRole?: string;
  isSignedIn?: boolean;
  isGrafanaAdmin?: boolean;
  featureToggles?: typeof config.featureToggles;
  config?: Partial<
    Pick<
      typeof config,
      | 'appSubUrl'
      | 'anonymousEnabled'
      | 'exploreEnabled'
      | 'profileEnabled'
      | 'helpEnabled'
      | 'snapshotEnabled'
      | 'publicDashboardsEnabled'
      | 'unifiedAlertingEnabled'
      | 'supportBundlesEnabled'
      | 'ldapEnabled'
      | 'pluginAdminEnabled'
      | 'cloudMigrationEnabled'
      | 'disableLoginForm'
      | 'publicDashboardAccessToken'
      | 'provisioningEnabled'
      | 'navigationAppSections'
    >
  >;
}

/**
 * Puts config and contextSrv into a known state for nav tree builder tests.
 * Jest isolates modules per test file, so mutations don't leak across files;
 * call this in beforeEach (or per test) to reset between cases.
 */
export function setupNavTestState({
  permissions = [],
  orgRole = 'Viewer',
  isSignedIn = true,
  isGrafanaAdmin = false,
  featureToggles = {},
  config: configOverrides = {},
}: NavTestState = {}) {
  contextSrv.user.permissions = Object.fromEntries(permissions.map((action) => [action, true]));
  contextSrv.user.orgRole = orgRoleOf(orgRole);
  contextSrv.isSignedIn = isSignedIn;
  contextSrv.user.isSignedIn = isSignedIn;
  contextSrv.isGrafanaAdmin = isGrafanaAdmin;
  contextSrv.user.name = 'Test User';
  contextSrv.user.login = 'testuser';
  contextSrv.user.gravatarUrl = '/avatar/abc';
  contextSrv.user.orgName = 'Main Org.';

  config.buildInfo = { ...config.buildInfo, env: 'production', edition: GrafanaEdition.OpenSource };
  Object.assign(config, {
    appSubUrl: '',
    anonymousEnabled: false,
    exploreEnabled: true,
    profileEnabled: true,
    helpEnabled: true,
    snapshotEnabled: true,
    publicDashboardsEnabled: true,
    unifiedAlertingEnabled: true,
    supportBundlesEnabled: false,
    ldapEnabled: false,
    pluginAdminEnabled: true,
    cloudMigrationEnabled: false,
    disableLoginForm: false,
    publicDashboardAccessToken: undefined,
    provisioningEnabled: false,
    navigationAppSections: {},
    featureToggles,
    ...configOverrides,
  });
}

function orgRoleOf(role: string): (typeof contextSrv.user)['orgRole'] {
  // The builders treat orgRole as a plain string; tests exercise real role names
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return role as (typeof contextSrv.user)['orgRole'];
}

export const navIds = (nodes: NavModelItem[]) => nodes.map((node) => node.id);
