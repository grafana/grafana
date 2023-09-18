import { merge } from 'lodash';

import {
  AuthSettings,
  BootData,
  BuildInfo,
  DataSourceInstanceSettings,
  FeatureToggles,
  GrafanaConfig,
  GrafanaTheme,
  GrafanaTheme2,
  LicenseInfo,
  MapLayerOptions,
  OAuthSettings,
  PanelPluginMeta,
  systemDateFormats,
  SystemDateFormatSettings,
  getThemeById,
} from '@grafana/data';

export interface AzureSettings {
  cloud?: string;
  managedIdentityEnabled: boolean;
  userIdentityEnabled: boolean;
}

export type AppPluginConfig = {
  id: string;
  path: string;
  version: string;
  preload: boolean;
  angularDetected?: boolean;
};

export class GrafanaBootConfig implements GrafanaConfig {
  publicDashboardAccessToken?: string;
  snapshotEnabled = true;
  datasources: { [str: string]: DataSourceInstanceSettings } = {};
  panels: { [key: string]: PanelPluginMeta } = {};
  apps: Record<string, AppPluginConfig> = {};
  auth: AuthSettings = {};
  minRefreshInterval = '';
  appUrl = '';
  appSubUrl = '';
  windowTitlePrefix = '';
  buildInfo: BuildInfo;
  newPanelTitle = '';
  bootData: BootData;
  externalUserMngLinkUrl = '';
  externalUserMngLinkName = '';
  externalUserMngInfo = '';
  allowOrgCreate = false;
  feedbackLinksEnabled = true;
  disableLoginForm = false;
  defaultDatasource = ''; // UID
  alertingEnabled = false;
  alertingErrorOrTimeout = '';
  alertingNoDataOrNullValues = '';
  alertingMinInterval = 1;
  angularSupportEnabled = false;
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
  loginError: string | undefined = undefined;
  viewersCanEdit = false;
  editorsCanAdmin = false;
  disableSanitizeHtml = false;
  trustedTypesDefaultPolicyEnabled = false;
  cspReportOnlyEnabled = false;
  liveEnabled = true;
  /** @deprecated Use `theme2` instead. */
  theme: GrafanaTheme;
  theme2: GrafanaTheme2;
  featureToggles: FeatureToggles = {};
  anonymousEnabled = false;
  licenseInfo: LicenseInfo = {} as LicenseInfo;
  rendererAvailable = false;
  dashboardPreviews: {
    systemRequirements: {
      met: boolean;
      requiredImageRendererPluginVersion: string;
    };
    thumbnailsExist: boolean;
  } = { systemRequirements: { met: false, requiredImageRendererPluginVersion: '' }, thumbnailsExist: false };
  rendererVersion = '';
  secretsManagerPluginEnabled = false;
  supportBundlesEnabled = false;
  http2Enabled = false;
  dateFormats?: SystemDateFormatSettings;
  grafanaJavascriptAgent = {
    enabled: false,
    customEndpoint: '',
    apiKey: '',
    errorInstrumentalizationEnabled: true,
    consoleInstrumentalizationEnabled: false,
    webVitalsInstrumentalizationEnabled: false,
  };
  pluginCatalogURL = 'https://grafana.com/grafana/plugins/';
  pluginAdminEnabled = true;
  pluginAdminExternalManageEnabled = false;
  pluginCatalogHiddenPlugins: string[] = [];
  pluginsCDNBaseURL = '';
  expressionsEnabled = false;
  customTheme?: undefined;
  awsAllowedAuthProviders: string[] = [];
  awsAssumeRoleEnabled = false;
  azure: AzureSettings = {
    managedIdentityEnabled: false,
    userIdentityEnabled: false,
  };
  caching = {
    enabled: false,
  };
  geomapDefaultBaseLayerConfig?: MapLayerOptions;
  geomapDisableCustomBaseLayer?: boolean;
  unifiedAlertingEnabled = false;
  unifiedAlerting = {
    minInterval: '',
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
  googleAnalyticsId: undefined;
  googleAnalytics4Id: undefined;
  googleAnalytics4SendManualPageViews = false;
  rudderstackWriteKey: undefined;
  rudderstackDataPlaneUrl: undefined;
  rudderstackSdkUrl: undefined;
  rudderstackConfigUrl: undefined;
  sqlConnectionLimits = {
    maxOpenConns: 100,
    maxIdleConns: 100,
    connMaxLifetime: 14400,
  };

  tokenExpirationDayLimit: undefined;
  disableFrontendSandboxForPlugins: string[] = [];

  constructor(options: GrafanaBootConfig) {
    this.bootData = options.bootData;

    const defaults = {
      datasources: {},
      windowTitlePrefix: 'Grafana - ',
      panels: {},
      newPanelTitle: 'Panel Title',
      playlist_timespan: '1m',
      unsaved_changes_warning: true,
      appUrl: '',
      appSubUrl: '',
      buildInfo: {
        version: '1.0',
        commit: '1',
        env: 'production',
      },
      viewersCanEdit: false,
      editorsCanAdmin: false,
      disableSanitizeHtml: false,
    };

    merge(this, defaults, options);

    this.buildInfo = options.buildInfo || defaults.buildInfo;

    if (this.dateFormats) {
      systemDateFormats.update(this.dateFormats);
    }

    if (this.buildInfo.env === 'development') {
      overrideFeatureTogglesFromUrl(this);
    }

    overrideFeatureTogglesFromLocalStorage(this);

    if (this.featureToggles.disableAngular) {
      this.angularSupportEnabled = false;
    }

    // Creating theme after applying feature toggle overrides in case we need to toggle anything
    this.theme2 = getThemeById(this.bootData.user.theme);
    this.bootData.user.lightTheme = this.theme2.isLight;
    this.theme = this.theme2.v1;
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

  const params = new URLSearchParams(window.location.search);
  params.forEach((value, key) => {
    if (key.startsWith('__feature.')) {
      const featureToggles = config.featureToggles as Record<string, boolean>;
      const featureName = key.substring(10);
      const toggleState = value === 'true' || value === ''; // browser rewrites true as ''
      if (toggleState !== featureToggles[key]) {
        featureToggles[featureName] = toggleState;
        console.log(`Setting feature toggle ${featureName} = ${toggleState} via url`);
      }
    }
  });
}

const bootData = (window as any).grafanaBootData || {
  settings: {},
  user: {},
  navTree: [],
};

const options = bootData.settings;
options.bootData = bootData;

/**
 * Use this to access the {@link GrafanaBootConfig} for the current running Grafana instance.
 *
 * @public
 */
export const config = new GrafanaBootConfig(options);
