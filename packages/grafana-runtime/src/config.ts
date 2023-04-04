import { merge } from 'lodash';

import {
  AuthSettings,
  BootData,
  BuildInfo,
  createTheme,
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
  NewThemeOptions,
} from '@grafana/data';

export interface AzureSettings {
  cloud?: string;
  managedIdentityEnabled: boolean;
}

export type AppPluginConfig = {
  id: string;
  name: string;
  path: string;
  version: string;
  preload: boolean;
};

export class GrafanaBootConfig implements GrafanaConfig {
  isPublicDashboardView: boolean;
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
  ldapEnabled = false;
  jwtHeaderName = '';
  jwtUrlLogin = false;
  sigV4AuthEnabled = false;
  azureAuthEnabled = false;
  samlEnabled = false;
  samlName = '';
  autoAssignOrg = true;
  verifyEmailEnabled = false;
  oauth: OAuthSettings = {};
  rbacEnabled = true;
  disableUserSignUp = false;
  loginHint = '';
  passwordHint = '';
  loginError = undefined;
  viewersCanEdit = false;
  editorsCanAdmin = false;
  disableSanitizeHtml = false;
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
  sentry = {
    enabled: false,
    dsn: '',
    customEndpoint: '',
    sampleRate: 1,
  };
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
  };
  caching = {
    enabled: false,
  };
  geomapDefaultBaseLayerConfig?: MapLayerOptions;
  geomapDisableCustomBaseLayer?: boolean;
  unifiedAlertingEnabled = false;
  unifiedAlerting = { minInterval: '' };
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

  tokenExpirationDayLimit: undefined;

  constructor(options: GrafanaBootConfig) {
    this.bootData = options.bootData;
    this.bootData.user.lightTheme = getThemeMode(options) === 'light';
    this.isPublicDashboardView = options.bootData.settings.isPublicDashboardView;

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

    overrideFeatureTogglesFromUrl(this);

    if (this.featureToggles.disableAngular) {
      this.angularSupportEnabled = false;
    }

    // Creating theme after applying feature toggle overrides in case we need to toggle anything
    this.theme2 = createTheme(getThemeCustomizations(this));

    this.theme = this.theme2.v1;
    // Special feature toggle that impact theme/component looks
    this.theme2.flags.topnav = this.featureToggles.topnav;
  }
}

function getThemeMode(config: GrafanaBootConfig) {
  let mode: 'light' | 'dark' = 'dark';
  const themePref = config.bootData.user.theme;

  if (themePref === 'light' || themePref === 'dark') {
    mode = themePref;
  } else if (themePref === 'system') {
    const mediaResult = window.matchMedia('(prefers-color-scheme: dark)');
    mode = mediaResult.matches ? 'dark' : 'light';
  }

  return mode;
}

function getThemeCustomizations(config: GrafanaBootConfig) {
  // if/when we remove CurrentUserDTO.lightTheme, change this to use getThemeMode instead
  const mode = config.bootData.user.lightTheme ? 'light' : 'dark';

  const themeOptions: NewThemeOptions = {
    colors: { mode },
  };

  return themeOptions;
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
      const toggleState = value === 'true';
      if (toggleState !== featureToggles[key]) {
        featureToggles[featureName] = toggleState;
        console.log(`Setting feature toggle ${featureName} = ${toggleState}`);
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
