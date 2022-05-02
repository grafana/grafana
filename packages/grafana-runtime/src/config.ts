import { merge } from 'lodash';

import {
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
  PreloadPlugin,
  systemDateFormats,
  SystemDateFormatSettings,
} from '@grafana/data';

export interface AzureSettings {
  cloud?: string;
  managedIdentityEnabled: boolean;
}

export class GrafanaBootConfig implements GrafanaConfig {
  datasources: { [str: string]: DataSourceInstanceSettings } = {};
  panels: { [key: string]: PanelPluginMeta } = {};
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
  sigV4AuthEnabled = false;
  samlEnabled = false;
  samlName = '';
  autoAssignOrg = true;
  verifyEmailEnabled = false;
  oauth: OAuthSettings = {};
  disableUserSignUp = false;
  loginHint = '';
  passwordHint = '';
  loginError = undefined;
  navTree: any;
  viewersCanEdit = false;
  editorsCanAdmin = false;
  disableSanitizeHtml = false;
  liveEnabled = true;
  theme: GrafanaTheme;
  theme2: GrafanaTheme2;
  pluginsToPreload: PreloadPlugin[] = [];
  featureToggles: FeatureToggles = {};
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
  http2Enabled = false;
  dateFormats?: SystemDateFormatSettings;
  sentry = {
    enabled: false,
    dsn: '',
    customEndpoint: '',
    sampleRate: 1,
  };
  pluginCatalogURL = 'https://grafana.com/grafana/plugins/';
  pluginAdminEnabled = true;
  pluginAdminExternalManageEnabled = false;
  pluginCatalogHiddenPlugins: string[] = [];
  expressionsEnabled = false;
  customTheme?: any;
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

  constructor(options: GrafanaBootConfig) {
    const mode = options.bootData.user.lightTheme ? 'light' : 'dark';
    this.theme2 = createTheme({ colors: { mode } });
    this.theme = this.theme2.v1;
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
  }
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
