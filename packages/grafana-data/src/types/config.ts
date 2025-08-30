import { SystemDateFormatSettings } from '../datetime/formats';
import { MapLayerOptions } from '../geo/layer';

import { DataSourceInstanceSettings } from './datasource';
import { FeatureToggles } from './featureToggles.gen';
import { IconName } from './icon';
import { NavLinkDTO } from './navModel';
import { OrgRole } from './orgs';
import { PanelPluginMeta } from './panel';
import { AngularMeta, PluginDependencies, PluginExtensions, PluginLoadingStrategy } from './plugin';
import { TimeOption } from './time';

export interface AzureSettings {
  cloud?: string;
  clouds?: AzureCloudInfo[];
  managedIdentityEnabled: boolean;
  workloadIdentityEnabled: boolean;
  userIdentityEnabled: boolean;
  userIdentityFallbackCredentialsEnabled: boolean;
  azureEntraPasswordCredentialsEnabled: boolean;
}

export interface AzureCloudInfo {
  name: string;
  displayName: string;
}

export type AppPluginConfig = {
  id: string;
  path: string;
  version: string;
  preload: boolean;
  angular: AngularMeta;
  loadingStrategy: PluginLoadingStrategy;
  dependencies: PluginDependencies;
  extensions: PluginExtensions;
  moduleHash?: string;
};

export type PreinstalledPlugin = {
  id: string;
  version: string;
};

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
  buildstamp: number;
  commit: string;
  commitShort: string;
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

export interface UnifiedAlertingStateHistoryConfig {
  backend?: string;
  primary?: string;
  prometheusTargetDatasourceUID?: string;
  prometheusMetricName?: string;
}

export interface UnifiedAlertingConfig {
  minInterval: string;
  stateHistory?: UnifiedAlertingStateHistoryConfig;
  recordingRulesEnabled?: boolean;
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

/**
 * Current user info included in bootData.
 * Corresponds to `window.grafanaBootData.user`
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

/**
 * Contains essential user and config info.
 * Corresponds to `window.grafanaBootData`.
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
 * Corresponds to `window.grafanaBootData.settings`.
 * If you want to access these values, use the `config` object from `@grafana/runtime`.
 * @internal
 */
export interface GrafanaConfig {
  publicDashboardAccessToken: string;
  publicDashboardsEnabled: boolean;
  snapshotEnabled: boolean;
  datasources: { [str: string]: DataSourceInstanceSettings };
  panels: { [key: string]: PanelPluginMeta };
  apps: Record<string, AppPluginConfig>;
  auth: AuthSettings;
  minRefreshInterval: string;
  appUrl: string;
  appSubUrl: string;
  azure: AzureSettings;
  jwtHeaderName: string;
  jwtUrlLogin: boolean;
  windowTitlePrefix: string;
  buildInfo: BuildInfo;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  externalUserMngAnalytics: boolean;
  externalUserMngAnalyticsParams: string;
  allowOrgCreate: boolean;
  disableLoginForm: boolean;
  defaultDatasource: string;
  defaultDatasourceManageAlertsUIToggle: boolean;
  defaultAllowRecordingRulesTargetAlertsUIToggle: boolean;
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
  samlName: string;
  awsAllowedAuthProviders: string[];
  awsAssumeRoleProvided: boolean;
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
  expressionsEnabled: boolean;
  liveEnabled: boolean;
  liveMessageSizeLimit: number;
  anonymousEnabled: boolean;
  anonymousDeviceLimit: number;
  featureToggles: FeatureToggles;
  licenseInfo: LicenseInfo;
  http2Enabled: boolean;
  dateFormats?: SystemDateFormatSettings;
  grafanaJavascriptAgent: GrafanaJavascriptAgentConfig;
  geomapDefaultBaseLayerConfig?: MapLayerOptions;
  geomapDisableCustomBaseLayer: boolean;
  unifiedAlertingEnabled: boolean;
  unifiedAlerting: UnifiedAlertingConfig;
  feedbackLinksEnabled: boolean;
  supportBundlesEnabled: boolean;
  secureSocksDSProxyEnabled: boolean;
  enableFrontendSandboxForPlugins: string[];
  googleAnalyticsId: string;
  googleAnalytics4Id: string;
  googleAnalytics4SendManualPageViews: boolean;
  rudderstackWriteKey: string;
  rudderstackDataPlaneUrl: string;
  rudderstackSdkUrl: string;
  rudderstackConfigUrl: string;
  rudderstackIntegrationsUrl: string;
  applicationInsightsConnectionString: string;
  applicationInsightsEndpointUrl: string;
  analyticsConsoleReporting: boolean;
  rendererAvailable: boolean;
  rendererVersion: string;
  rendererDefaultImageWidth: number;
  rendererDefaultImageHeight: number;
  rendererDefaultImageScale: number;
  dashboardPerformanceMetrics: string[];
  panelSeriesLimit: number;
  sqlConnectionLimits: SqlConnectionLimits;
  sharedWithMeFolderUID: string;
  rootFolderUID: string;
  localFileSystemAvailable: boolean;
  cloudMigrationIsTarget: boolean;
  cloudMigrationPollIntervalMs: number;
  pluginCatalogURL: string;
  pluginAdminEnabled: boolean;
  pluginAdminExternalManageEnabled: boolean;
  pluginCatalogHiddenPlugins: string[];
  pluginCatalogManagedPlugins: string[];
  pluginCatalogPreinstalledPlugins: PreinstalledPlugin[];
  pluginsCDNBaseURL: string;
  tokenExpirationDayLimit: number;
  listDashboardScopesEndpoint: string;
  listScopesEndpoint: string;
  reportingStaticContext: Record<string, string>;
  exploreDefaultTimeOffset: string;
  exploreHideLogsDownload: boolean;
  quickRanges?: TimeOption[];

  // The namespace to use for kubernetes apiserver requests
  namespace: string;
  caching: {
    enabled: boolean;
  };
  recordedQueries: {
    enabled: boolean;
  };
  reporting: {
    enabled: boolean;
  };
  analytics: {
    enabled: boolean;
  };
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
