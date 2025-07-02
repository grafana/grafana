import { SystemDateFormatSettings } from '../datetime/formats';
import { MapLayerOptions } from '../geo/layer';
import { GrafanaTheme2 } from '../themes/types';

import { DataSourceInstanceSettings } from './datasource';
import { FeatureToggles } from './featureToggles.gen';
import { IconName } from './icon';
import { NavLinkDTO } from './navModel';
import { OrgRole } from './orgs';
import { PanelPluginMeta } from './panel';
import { GrafanaTheme } from './theme';
import { TimeOption } from './time';

/**
 * Describes the build information that will be available via the Grafana configuration.
 *
 * @public
 */
export interface BuildInfo {
  // This MUST be a semver-ish version string, such as "11.0.0-54321"
  version: string;
  // Version to show in the UI instead of version
  versionString: string;
  commit: string;
  env: string;
  edition: GrafanaEdition;
  latestVersion: string;
  hasUpdate: boolean;
  hideVersion: boolean;
}

/**
 * @internal
 */
export enum GrafanaEdition {
  OpenSource = 'Open Source',
  Pro = 'Pro',
  Enterprise = 'Enterprise',
}

/**
 * Describes the license information about the current running instance of Grafana.
 *
 * @public
 */
export interface LicenseInfo {
  expiry: number;
  licenseUrl: string;
  stateInfo: string;
  edition: GrafanaEdition;
  enabledFeatures: { [key: string]: boolean };
  trialExpiry?: number;
}

/**
 * Describes GrafanaJavascriptAgentConfig integration config
 *
 * @public
 */
export interface GrafanaJavascriptAgentConfig {
  enabled: boolean;
  customEndpoint: string;
  errorInstrumentalizationEnabled: boolean;
  consoleInstrumentalizationEnabled: boolean;
  webVitalsInstrumentalizationEnabled: boolean;
  tracingInstrumentalizationEnabled: boolean;
  apiKey: string;
}

export interface UnifiedAlertingConfig {
  minInterval: string;
  // will be undefined if alerStateHistory is not enabled
  alertStateHistoryBackend?: string;
  // will be undefined if implementation is not "multiple"
  alertStateHistoryPrimary?: string;
  recordingRulesEnabled?: boolean;
  // will be undefined if no default datasource is configured
  defaultRecordingRulesTargetDatasourceUID?: string;
}

/** Supported OAuth services
 *
 * @public
 */
export type OAuth =
  | 'github'
  | 'gitlab'
  | 'google'
  | 'generic_oauth'
  // | 'grafananet' Deprecated. Key always changed to "grafana_com"
  | 'grafana_com'
  | 'azuread'
  | 'okta';

/** Map of enabled OAuth services and their respective names
 *
 * @public
 */
export type OAuthSettings = Partial<Record<OAuth, { name: string; icon?: IconName }>>;

/**
 * Information needed for analytics providers
 *
 * @internal
 */
export interface AnalyticsSettings {
  identifier: string;
  intercomIdentifier?: string;
}

/** Current user info included in bootData
 *
 * @internal
 */
export interface CurrentUserDTO {
  isSignedIn: boolean;
  id: number;
  uid: string;
  externalUserId: string;
  login: string;
  email: string;
  name: string;
  theme: string; // dark | light | system
  orgCount: number;
  orgId: number;
  orgName: string;
  orgRole: OrgRole | '';
  isGrafanaAdmin: boolean;
  gravatarUrl: string;
  timezone: string;
  weekStart: string;
  regionalFormat: string;
  language: string;
  permissions?: Record<string, boolean>;
  analytics: AnalyticsSettings;
  authenticatedBy: string;

  /** @deprecated Use theme instead */
  lightTheme: boolean;
}

/** Contains essential user and config info
 *
 * @internal
 */
export interface BootData {
  user: CurrentUserDTO;
  settings: GrafanaConfig;
  navTree: NavLinkDTO[];
  assets: {
    light: string;
    dark: string;
  };
}

/**
 * Describes all the different Grafana configuration values available for an instance.
 *
 * @internal
 */
export interface GrafanaConfig {
  publicDashboardAccessToken?: string;
  publicDashboardsEnabled: boolean;
  snapshotEnabled: boolean;
  datasources: { [str: string]: DataSourceInstanceSettings };
  panels: { [key: string]: PanelPluginMeta };
  auth: AuthSettings;
  minRefreshInterval: string;
  appSubUrl: string;
  windowTitlePrefix: string;
  buildInfo: BuildInfo;
  bootData: BootData;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  externalUserMngAnalytics: boolean;
  externalUserMngAnalyticsParams: string;
  allowOrgCreate: boolean;
  disableLoginForm: boolean;
  defaultDatasource: string;
  authProxyEnabled: boolean;
  exploreEnabled: boolean;
  queryHistoryEnabled: boolean;
  helpEnabled: boolean;
  profileEnabled: boolean;
  newsFeedEnabled: boolean;
  ldapEnabled: boolean;
  sigV4AuthEnabled: boolean;
  azureAuthEnabled: boolean;
  samlEnabled: boolean;
  autoAssignOrg: boolean;
  verifyEmailEnabled: boolean;
  oauth: OAuthSettings;
  /** @deprecated always set to true. */
  rbacEnabled: boolean;
  disableUserSignUp: boolean;
  loginHint: string;
  passwordHint: string;
  loginError?: string;
  viewersCanEdit: boolean;
  disableSanitizeHtml: boolean;
  trustedTypesDefaultPolicyEnabled: boolean;
  cspReportOnlyEnabled: boolean;
  liveEnabled: boolean;
  liveMessageSizeLimit: number;
  /** @deprecated Use `theme2` instead. */
  theme: GrafanaTheme;
  theme2: GrafanaTheme2;
  anonymousEnabled: boolean;
  anonymousDeviceLimit: number | undefined;
  featureToggles: FeatureToggles;
  licenseInfo: LicenseInfo;
  http2Enabled: boolean;
  dateFormats?: SystemDateFormatSettings;
  grafanaJavascriptAgent: GrafanaJavascriptAgentConfig;
  geomapDefaultBaseLayer?: MapLayerOptions;
  geomapDisableCustomBaseLayer?: boolean;
  unifiedAlertingEnabled: boolean;
  unifiedAlerting: UnifiedAlertingConfig;
  feedbackLinksEnabled: boolean;
  supportBundlesEnabled: boolean;
  secureSocksDSProxyEnabled: boolean;
  googleAnalyticsId: string | undefined;
  googleAnalytics4Id: string | undefined;
  googleAnalytics4SendManualPageViews: boolean;
  rudderstackWriteKey: string | undefined;
  rudderstackDataPlaneUrl: string | undefined;
  rudderstackSdkUrl: string | undefined;
  rudderstackConfigUrl: string | undefined;
  rudderstackIntegrationsUrl: string | undefined;
  analyticsConsoleReporting: boolean;
  dashboardPerformanceMetrics: string[];
  panelSeriesLimit: number;
  sqlConnectionLimits: SqlConnectionLimits;
  sharedWithMeFolderUID?: string;
  rootFolderUID?: string;
  localFileSystemAvailable?: boolean;
  cloudMigrationIsTarget?: boolean;
  listDashboardScopesEndpoint?: string;
  listScopesEndpoint?: string;
  reportingStaticContext?: Record<string, string>;
  exploreDefaultTimeOffset?: string;
  exploreHideLogsDownload?: boolean;
  quickRanges?: TimeOption[];

  // The namespace to use for kubernetes apiserver requests
  namespace: string;

  /**
   * Language used in Grafana's UI. This is after the user's preference (or deteceted locale) is resolved to one of
   * Grafana's supported language.
   */
  language: string | undefined;
  regionalFormat: string;
}

export interface SqlConnectionLimits {
  maxOpenConns: number;
  maxIdleConns: number;
  connMaxLifetime: number;
}

export interface AuthSettings {
  AuthProxyEnableLoginToken?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  OAuthSkipOrgRoleUpdateSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  SAMLSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  LDAPSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  JWTAuthSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  GrafanaComSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  GithubSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  GitLabSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  OktaSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  AzureADSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  GoogleSkipOrgRoleSync?: boolean;
  // @deprecated -- this is no longer used and will be removed in Grafana 11
  GenericOAuthSkipOrgRoleSync?: boolean;

  disableLogin?: boolean;
  passwordlessEnabled?: boolean;
  basicAuthStrongPasswordPolicy?: boolean;
  disableSignoutMenu?: boolean;
}
