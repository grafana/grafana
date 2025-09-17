import { merge } from 'lodash';

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

/**
 * Use to access Grafana config settings in application code.
 * This takes `window.grafanaBootData.settings` as input and returns a config object.
 */
export class GrafanaBootConfig {
  publicDashboardAccessToken?: string;
  publicDashboardsEnabled = true;
  snapshotEnabled = true;
  datasources: { [str: string]: DataSourceInstanceSettings } = {};
  panels: { [key: string]: PanelPluginMeta } = {};
  apps: Record<string, AppPluginConfigGrafanaData> = {};
  auth: AuthSettings = {};
  minRefreshInterval = '';
  appUrl = '';
  appSubUrl = '';
  namespace = 'default';
  windowTitlePrefix = 'Grafana - ';
  buildInfo: BuildInfo = {
    version: '1.0',
    commit: '1',
    env: 'production',
  } as BuildInfo;
  bootData: BootData;
  externalUserMngLinkUrl = '';
  externalUserMngLinkName = '';
  externalUserMngInfo = '';
  externalUserMngAnalytics = false;
  externalUserMngAnalyticsParams = '';
  allowOrgCreate = false;
  feedbackLinksEnabled = true;
  disableLoginForm = false;
  defaultDatasource = ''; // UID
  authProxyEnabled = false;
  exploreEnabled = false;
  queryHistoryEnabled = false;
  helpEnabled = false;
  profileEnabled = false;
  newsFeedEnabled = true;
  ldapEnabled = false;
  jwtHeaderName = '';
  jwtUrlLogin = false;
  sigV4AuthEnabled = false;
  azureAuthEnabled = false;
  secureSocksDSProxyEnabled = false;
  samlEnabled = false;
  samlName = '';
  autoAssignOrg = true;
  verifyEmailEnabled = false;
  oauth: OAuthSettings = {};
  rbacEnabled = true;
  disableUserSignUp = false;
  loginHint = '';
  passwordHint = '';
  loginError?: string;
  viewersCanEdit = false;
  disableSanitizeHtml = false;
  trustedTypesDefaultPolicyEnabled = false;
  cspReportOnlyEnabled = false;
  liveEnabled = true;
  liveMessageSizeLimit = 65536;
  /** @deprecated Use `theme2` instead. */
  theme: GrafanaTheme;
  theme2: GrafanaTheme2;
  featureToggles: FeatureToggles = {};
  anonymousEnabled = false;
  anonymousDeviceLimit?: number;
  licenseInfo: LicenseInfo = {} as LicenseInfo;
  rendererAvailable = false;
  rendererVersion = '';
  rendererDefaultImageWidth = 1000;
  rendererDefaultImageHeight = 500;
  rendererDefaultImageScale = 1;
  supportBundlesEnabled = false;
  http2Enabled = false;
  dateFormats?: SystemDateFormatSettings;
  grafanaJavascriptAgent = {
    enabled: false,
    customEndpoint: '',
    apiKey: '',
    allInstrumentationsEnabled: false,
    errorInstrumentalizationEnabled: true,
    consoleInstrumentalizationEnabled: false,
    webVitalsInstrumentalizationEnabled: false,
    tracingInstrumentalizationEnabled: false,
  };
  pluginCatalogURL = 'https://grafana.com/grafana/plugins/';
  pluginAdminEnabled = true;
  pluginAdminExternalManageEnabled = false;
  pluginCatalogHiddenPlugins: string[] = [];
  pluginCatalogManagedPlugins: string[] = [];
  pluginCatalogPreinstalledPlugins: PreinstalledPluginGrafanaData[] = [];
  pluginsCDNBaseURL = '';
  expressionsEnabled = false;
  awsAllowedAuthProviders: string[] = [];
  awsAssumeRoleEnabled = false;
  azure: AzureSettingsGrafanaData = {
    managedIdentityEnabled: false,
    workloadIdentityEnabled: false,
    userIdentityEnabled: false,
    userIdentityFallbackCredentialsEnabled: false,
    azureEntraPasswordCredentialsEnabled: false,
  };
  caching = {
    enabled: false,
  };
  geomapDefaultBaseLayerConfig?: MapLayerOptions;
  geomapDisableCustomBaseLayer?: boolean;
  unifiedAlertingEnabled = false;
  unifiedAlerting: UnifiedAlertingConfig = {
    minInterval: '',
    stateHistory: {
      backend: undefined,
      primary: undefined,
      prometheusTargetDatasourceUID: undefined,
      prometheusMetricName: undefined,
    },
    recordingRulesEnabled: false,
    defaultRecordingRulesTargetDatasourceUID: undefined,

    // Backward compatibility fields - populated by backend
    alertStateHistoryBackend: undefined,
    alertStateHistoryPrimary: undefined,
  };
  applicationInsightsConnectionString?: string;
  applicationInsightsEndpointUrl?: string;
  recordedQueries = {
    enabled: true,
  };
  featureHighlights = {
    enabled: false,
  };
  reporting = {
    enabled: true,
  };
  analytics = {
    enabled: true,
  };
  googleAnalyticsId?: string;
  googleAnalytics4Id?: string;
  googleAnalytics4SendManualPageViews = false;
  rudderstackWriteKey?: string;
  rudderstackDataPlaneUrl?: string;
  rudderstackSdkUrl?: string;
  rudderstackConfigUrl?: string;
  rudderstackIntegrationsUrl?: string;
  analyticsConsoleReporting = false;
  dashboardPerformanceMetrics: string[] = [];
  panelSeriesLimit = 0;
  sqlConnectionLimits = {
    maxOpenConns: 100,
    maxIdleConns: 100,
    connMaxLifetime: 14400,
  };
  defaultDatasourceManageAlertsUiToggle = true;
  defaultAllowRecordingRulesTargetAlertsUiToggle = true;
  tokenExpirationDayLimit?: number;
  enableFrontendSandboxForPlugins: string[] = [];
  sharedWithMeFolderUID?: string;
  rootFolderUID?: string;
  localFileSystemAvailable?: boolean;
  cloudMigrationIsTarget?: boolean;
  cloudMigrationPollIntervalMs = 2000;
  reportingStaticContext?: Record<string, string>;
  exploreDefaultTimeOffset = '1h';
  exploreHideLogsDownload?: boolean;
  quickRanges?: TimeOption[];
  pluginRestrictedAPIsAllowList?: Record<string, string[]>;
  pluginRestrictedAPIsBlockList?: Record<string, string[]>;

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
  listDashboardScopesEndpoint = '';
  listScopesEndpoint = '';

  constructor(
    options: BootData['settings'] & {
      bootData: BootData;
    }
  ) {
    this.bootData = options.bootData;

    merge(this, options);

    if (this.dateFormats) {
      systemDateFormats.update(this.dateFormats);
    }

    overrideFeatureTogglesFromUrl(this);
    overrideFeatureTogglesFromLocalStorage(this);

    // Creating theme after applying feature toggle overrides in case we need to toggle anything
    this.theme2 = getThemeById(this.bootData.user.theme);
    this.bootData.user.lightTheme = this.theme2.isLight;
    this.theme = this.theme2.v1;
    this.regionalFormat = options.bootData.user.regionalFormat;
  }
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
export const config = new GrafanaBootConfig({
  ...bootData.settings,
  // need to separately include bootData here
  // this allows people to access the user object on config.bootData.user and maintains backwards compatibility
  // TODO expose a user object (similar to `GrafanaBootConfig`) and deprecate this recursive bootData
  bootData,
});
