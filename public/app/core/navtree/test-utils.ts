import type { AppPluginConfig, NavModelItem, OrgRole, PluginInclude } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { clearAppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

/**
 * The role names tests pass, kept in sync with the OrgRole enum values, plus the
 * empty string a session without an org carries (anonymous, login, snapshots).
 */
type OrgRoleName = `${OrgRole}` | '';

export interface NavTestState {
  permissions?: string[];
  orgRole?: OrgRoleName;
  isSignedIn?: boolean;
  isGrafanaAdmin?: boolean;
  featureToggles?: typeof config.featureToggles;
  /** OpenFeature flags, set (and reset between calls) via setTestFlags */
  openFeatureFlags?: Record<string, boolean>;
  config?: Partial<typeof config>;
}

/**
 * Puts config, contextSrv and OpenFeature flags into a known state for nav tree
 * builder tests. Jest isolates modules per test file, so mutations don't leak
 * across files; call this in beforeEach (or per test) to reset between cases.
 */
export function setupNavTestState({
  permissions = [],
  orgRole = 'Viewer',
  isSignedIn = true,
  isGrafanaAdmin = false,
  featureToggles = {},
  openFeatureFlags = {},
  config: configOverrides = {},
}: NavTestState = {}) {
  contextSrv.user = {
    ...contextSrv.user,
    permissions: Object.fromEntries(permissions.map((action) => [action, true])),
    orgRole: orgRole as OrgRole,
    isSignedIn,
    name: 'Test User',
    login: 'testuser',
    gravatarUrl: '/avatar/abc',
    orgName: 'Main Org.',
  };
  contextSrv.isSignedIn = isSignedIn;
  contextSrv.isGrafanaAdmin = isGrafanaAdmin;

  setTestFlags(openFeatureFlags);

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
    auth: {},
    publicDashboardAccessToken: undefined,
    provisioningEnabled: false,
    navigation: {},
    featureToggles,
    ...configOverrides,
  });
}

/**
 * Primes the app plugin metas cache so getAppPluginMetasSync — and with it the
 * plugin merge inside getInitialNavTree — sees these apps. Pass no apps to
 * clear it. Only the fields the nav builder reads need supplying.
 */
export function setupNavTestApps(apps: AppPluginConfig[] = []) {
  // With nothing to install, leave the cache uninitialised rather than setting an
  // empty one: that is the state a boot which skipped the metas fetch leaves behind
  if (apps.length === 0) {
    clearAppPluginMetas();
    return;
  }
  setAppPluginMetas(Object.fromEntries(apps.map((app) => [app.id, app])));
}

/**
 * An app plugin config carrying only the fields the nav reads. applyPluginNav
 * takes these directly, so tests build them here rather than going through the
 * metas endpoint — keep one MSW-backed case per suite for the fetch and mapper.
 *
 * The cast lives here, once, instead of in each test: AppPluginConfig has a
 * dozen loader fields the nav never touches.
 */
export function appPluginConfig(
  id: string,
  name: string,
  includes: PluginInclude[] = [],
  rest: Partial<AppPluginConfig> = {}
): AppPluginConfig {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    id,
    name,
    includes,
    info: {
      logos: { small: `/plugins/${id}/small.svg`, large: `/plugins/${id}/large.svg` },
      description: name,
    },
    ...rest,
  } as AppPluginConfig;
}

/** A page include, which is what most nav cases need */
export function appPage(name: string, path: string, extra: Partial<PluginInclude> = {}): PluginInclude {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { type: 'page', name, path, addToNav: true, ...extra } as PluginInclude;
}

export const navIds = (nodes: NavModelItem[]) => nodes.map((node) => node.id);
