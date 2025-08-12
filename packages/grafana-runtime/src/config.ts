import {
  AppPluginConfig as AppPluginConfigGrafanaData,
  AuthSettings,
  AzureSettings as AzureSettingsGrafanaData,
  BootData,
  BuildInfo,
  DataSourceInstanceSettings,
  FeatureToggles,
  GrafanaTheme,
  GrafanaTheme2,
  LicenseInfo,
  MapLayerOptions,
  OAuthSettings,
  PanelPluginMeta,
  PreinstalledPlugin as PreinstalledPluginGrafanaData,
  systemDateFormats,
  SystemDateFormatSettings,
  getThemeById,
  AngularMeta,
  PluginLoadingStrategy,
  PluginDependencies,
  PluginExtensions,
  TimeOption,
  UnifiedAlertingConfig,
  GrafanaConfig,
  CurrentUserDTO,
} from '@grafana/data';

/**
 * @deprecated Use the type from `@grafana/data`
 */
// TODO remove in G13
export interface AzureSettings {
  cloud?: string;
  clouds?: AzureCloudInfo[];
  managedIdentityEnabled: boolean;
  workloadIdentityEnabled: boolean;
  userIdentityEnabled: boolean;
  userIdentityFallbackCredentialsEnabled: boolean;
  azureEntraPasswordCredentialsEnabled: boolean;
}

/**
 * @deprecated Use the type from `@grafana/data`
 */
// TODO remove in G13
export interface AzureCloudInfo {
  name: string;
  displayName: string;
}

/**
 * @deprecated Use the type from `@grafana/data`
 */
// TODO remove in G13
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

/**
 * @deprecated Use the type from `@grafana/data`
 */
// TODO remove in G13
export type PreinstalledPlugin = {
  id: string;
  version: string;
};

export interface GrafanaBootConfig {
  publicDashboardAccessToken?: string;
  publicDashboardsEnabled: boolean;
  snapshotEnabled: boolean;
  datasources: { [str: string]: DataSourceInstanceSettings };
  panels: { [key: string]: PanelPluginMeta };
  apps: Record<string, AppPluginConfigGrafanaData>;
  auth: AuthSettings;
  minRefreshInterval: string;
  appUrl: string;
  appSubUrl: string;
  namespace: string;
  windowTitlePrefix: string;
  buildInfo: BuildInfo;
  bootData: BootData;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  externalUserMngAnalytics: boolean;
  externalUserMngAnalyticsParams: string;
  allowOrgCreate: boolean;
  feedbackLinksEnabled: boolean;
  disableLoginForm: boolean;
  defaultDatasource: string; // UID
  authProxyEnabled: boolean;
  exploreEnabled: boolean;
  queryHistoryEnabled: boolean;
  helpEnabled: boolean;
  profileEnabled: boolean;
  newsFeedEnabled: boolean;
  ldapEnabled: boolean;
  jwtHeaderName: string;
  jwtUrlLogin: boolean;
  sigV4AuthEnabled: boolean;
  azureAuthEnabled: boolean;
  secureSocksDSProxyEnabled: boolean;
  samlEnabled: boolean;
  samlName: string;
  autoAssignOrg: boolean;
  verifyEmailEnabled: boolean;
  oauth: OAuthSettings;
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
  featureToggles: FeatureToggles;
  anonymousEnabled: boolean;
  anonymousDeviceLimit?: number;
  licenseInfo: LicenseInfo;
  rendererAvailable: boolean;
  rendererVersion: string;
  rendererDefaultImageWidth: number;
  rendererDefaultImageHeight: number;
  rendererDefaultImageScale: number;
  supportBundlesEnabled: boolean;
  http2Enabled: boolean;
  dateFormats?: SystemDateFormatSettings;
  grafanaJavascriptAgent: {
    enabled: boolean;
    customEndpoint: string;
    apiKey: string;
    allInstrumentationsEnabled: boolean;
    errorInstrumentalizationEnabled: boolean;
    consoleInstrumentalizationEnabled: boolean;
    webVitalsInstrumentalizationEnabled: boolean;
    tracingInstrumentalizationEnabled: boolean;
  };
  pluginCatalogURL: string;
  pluginAdminEnabled: boolean;
  pluginAdminExternalManageEnabled: boolean;
  pluginCatalogHiddenPlugins: string[];
  pluginCatalogManagedPlugins: string[];
  pluginCatalogPreinstalledPlugins: PreinstalledPluginGrafanaData[];
  pluginsCDNBaseURL: string;
  expressionsEnabled: boolean;
  awsAllowedAuthProviders: string[];
  awsAssumeRoleEnabled: boolean;
  azure: AzureSettingsGrafanaData;
  caching: {
    enabled: boolean;
  };
  geomapDefaultBaseLayerConfig?: MapLayerOptions;
  geomapDisableCustomBaseLayer?: boolean;
  unifiedAlertingEnabled: boolean;
  unifiedAlerting: UnifiedAlertingConfig;
  applicationInsightsConnectionString?: string;
  applicationInsightsEndpointUrl?: string;
  recordedQueries: {
    enabled: boolean;
  };
  featureHighlights: {
    enabled: boolean;
  };
  reporting: {
    enabled: boolean;
  };
  analytics: {
    enabled: boolean;
  };
  googleAnalyticsId?: string;
  googleAnalytics4Id?: string;
  googleAnalytics4SendManualPageViews: boolean;
  rudderstackWriteKey?: string;
  rudderstackDataPlaneUrl?: string;
  rudderstackSdkUrl?: string;
  rudderstackConfigUrl?: string;
  rudderstackIntegrationsUrl?: string;
  analyticsConsoleReporting: boolean;
  dashboardPerformanceMetrics: string[];
  panelSeriesLimit: number;
  sqlConnectionLimits: {
    maxOpenConns: number;
    maxIdleConns: number;
    connMaxLifetime: number;
  };
  defaultDatasourceManageAlertsUiToggle: boolean;
  defaultAllowRecordingRulesTargetAlertsUiToggle: boolean;

  tokenExpirationDayLimit?: number;
  enableFrontendSandboxForPlugins: string[];
  sharedWithMeFolderUID?: string;
  rootFolderUID?: string;
  localFileSystemAvailable?: boolean;
  cloudMigrationIsTarget?: boolean;
  cloudMigrationPollIntervalMs: number;
  reportingStaticContext?: Record<string, string>;
  exploreDefaultTimeOffset: string;
  exploreHideLogsDownload?: boolean;
  quickRanges?: TimeOption[];

  /**
   * Language used in Grafana's UI. This is after the user's preference (or deteceted locale) is resolved to one of
   * Grafana's supported language.
   */
  language: string | undefined;

  /**
   * regionalFormat used in Grafana's UI. Default to 'es-US' in the backend and overwritten when the user select a different one in SharedPreferences.
   * This is the regionalFormat that is used for date formatting and other locale-specific features.
   */
  regionalFormat: string;
}

const defaults = {
  buildInfo: {
    version: '1.0',
    commit: '1',
    env: 'production',
  } as BuildInfo,
  publicDashboardsEnabled: true,
  snapshotEnabled: true,
  datasources: {},
  panels: {},
  apps: {},
  auth: {},
  minRefreshInterval: '',
  appUrl: '',
  appSubUrl: '',
  namespace: 'default',
  windowTitlePrefix: 'Grafana - ',
  externalUserMngLinkUrl: '',
  externalUserMngLinkName: '',
  externalUserMngInfo: '',
  externalUserMngAnalytics: false,
  externalUserMngAnalyticsParams: '',
  allowOrgCreate: false,
  feedbackLinksEnabled: true,
  disableLoginForm: false,
  defaultDatasource: '',
  authProxyEnabled: false,
  exploreEnabled: false,
  queryHistoryEnabled: false,
  helpEnabled: false,
  profileEnabled: false,
  newsFeedEnabled: true,
  ldapEnabled: false,
  jwtHeaderName: '',
  jwtUrlLogin: false,
  sigV4AuthEnabled: false,
  azureAuthEnabled: false,
  secureSocksDSProxyEnabled: false,
  samlEnabled: false,
  samlName: '',
  autoAssignOrg: true,
  verifyEmailEnabled: false,
  oauth: {},
  rbacEnabled: true,
  disableUserSignUp: false,
  loginHint: '',
  passwordHint: '',
  viewersCanEdit: false,
  disableSanitizeHtml: false,
  trustedTypesDefaultPolicyEnabled: false,
  cspReportOnlyEnabled: false,
  liveEnabled: true,
  liveMessageSizeLimit: 65536,
  featureToggles: {},
  anonymousEnabled: false,
  licenseInfo: {} as LicenseInfo,
  rendererAvailable: false,
  rendererVersion: '',
  rendererDefaultImageWidth: 1000,
  rendererDefaultImageHeight: 500,
  rendererDefaultImageScale: 1,
  supportBundlesEnabled: false,
  http2Enabled: false,
  grafanaJavascriptAgent: {
    enabled: false,
    customEndpoint: '',
    apiKey: '',
    allInstrumentationsEnabled: false,
    errorInstrumentalizationEnabled: true,
    consoleInstrumentalizationEnabled: false,
    webVitalsInstrumentalizationEnabled: false,
    tracingInstrumentalizationEnabled: false,
  },
  pluginCatalogURL: 'https://grafana.com/grafana/plugins/',
  pluginAdminEnabled: true,
  pluginAdminExternalManageEnabled: false,
  pluginCatalogHiddenPlugins: [],
  pluginCatalogManagedPlugins: [],
  pluginCatalogPreinstalledPlugins: [],
  pluginsCDNBaseURL: '',
  expressionsEnabled: false,
  awsAllowedAuthProviders: [],
  awsAssumeRoleEnabled: false,
  azure: {
    managedIdentityEnabled: false,
    workloadIdentityEnabled: false,
    userIdentityEnabled: false,
    userIdentityFallbackCredentialsEnabled: false,
    azureEntraPasswordCredentialsEnabled: false,
  },
  caching: {
    enabled: false,
  },
  unifiedAlertingEnabled: false,
  unifiedAlerting: {
    minInterval: '',
    recordingRulesEnabled: false,
  },
  recordedQueries: {
    enabled: true,
  },
  featureHighlights: {
    enabled: false,
  },
  reporting: {
    enabled: true,
  },
  analytics: {
    enabled: true,
  },
  googleAnalytics4SendManualPageViews: false,
  analyticsConsoleReporting: false,
  dashboardPerformanceMetrics: [],
  panelSeriesLimit: 0,
  sqlConnectionLimits: {
    maxOpenConns: 100,
    maxIdleConns: 100,
    connMaxLifetime: 14400,
  },
  defaultDatasourceManageAlertsUiToggle: true,
  defaultAllowRecordingRulesTargetAlertsUiToggle: true,
  enableFrontendSandboxForPlugins: [],
  cloudMigrationPollIntervalMs: 2000,
  exploreDefaultTimeOffset: '1h',
} satisfies Partial<GrafanaBootConfig>;

function makeGrafanaBootConfig(bootData: BootData): GrafanaBootConfig {
  const theme2 = getThemeById(bootData.user.theme);
  const result: GrafanaBootConfig = {
    ...defaults,
    ...bootData.settings,
    bootData,
    grafanaJavascriptAgent: {
      ...defaults.grafanaJavascriptAgent,
      ...bootData.settings.grafanaJavascriptAgent,
    },
    theme2,
    theme: theme2.v1,
    language: bootData.user.language,
    regionalFormat: bootData.user.regionalFormat,
  };

  if (result.dateFormats) {
    systemDateFormats.update(result.dateFormats);
  }

  overrideFeatureTogglesFromUrl(result);
  overrideFeatureTogglesFromLocalStorage(result);

  return result;
}

// localstorage key: grafana.featureToggles
// example value: panelEditor=1,panelInspector=1
function overrideFeatureTogglesFromLocalStorage(config: GrafanaBootConfig) {
  const featureToggles = config.featureToggles;
  const localStorageKey = 'grafana.featureToggles';
  const localStorageValue = window.localStorage.getItem(localStorageKey);
  if (localStorageValue) {
    const features = localStorageValue.split(',');
    for (const feature of features) {
      const [featureName, featureValue] = feature.split('=');
      const toggleState = featureValue === 'true' || featureValue === '1';
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      featureToggles[featureName as keyof FeatureToggles] = toggleState;
      console.log(`Setting feature toggle ${featureName} = ${toggleState} via localstorage`);
    }
  }
}

function overrideFeatureTogglesFromUrl(config: GrafanaBootConfig) {
  if (window.location.href.indexOf('__feature') === -1) {
    return;
  }

  const isDevelopment = config.buildInfo.env === 'development';

  // Although most flags can not be changed from the URL in production,
  // some of them are safe (and useful!) to change dynamically from the browser URL
  const safeRuntimeFeatureFlags = new Set(['queryServiceFromUI', 'dashboardSceneSolo']);

  const params = new URLSearchParams(window.location.search);
  params.forEach((value, key) => {
    if (key.startsWith('__feature.')) {
      const featureToggles = config.featureToggles as Record<string, boolean>;
      const featureName = key.substring(10);

      const toggleState = value === 'true' || value === ''; // browser rewrites true as ''
      if (toggleState !== featureToggles[key]) {
        if (isDevelopment || safeRuntimeFeatureFlags.has(featureName)) {
          featureToggles[featureName] = toggleState;
          console.log(`Setting feature toggle ${featureName} = ${toggleState} via url`);
        } else {
          console.log(`Unable to change feature toggle ${featureName} via url in production.`);
        }
      }
    }
  });
}

let bootData = window.grafanaBootData;

if (!bootData) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('window.grafanaBootData was not set by the time config was initialized');
  }

  bootData = {
    assets: {
      dark: '',
      light: '',
    },
    settings: {} as GrafanaConfig,
    user: {} as CurrentUserDTO,
    navTree: [],
  };
}

/**
 * Use this to access the {@link GrafanaBootConfig} for the current running Grafana instance.
 *
 * @public
 */
export const config = makeGrafanaBootConfig(bootData);
