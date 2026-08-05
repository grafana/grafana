import type { NavModelItem, OrgRole } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

/** The role names tests pass, kept in sync with the OrgRole enum values. */
type OrgRoleName = `${OrgRole}`;

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
    navigationAppSections: {},
    featureToggles,
    ...configOverrides,
  });
}

export const navIds = (nodes: NavModelItem[]) => nodes.map((node) => node.id);
