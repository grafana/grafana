import merge from 'lodash/merge';
import { getTheme } from '@grafana/ui';
import {
  BuildInfo,
  DataSourceInstanceSettings,
  FeatureToggles,
  GrafanaConfig,
  GrafanaTheme,
  GrafanaThemeType,
  LicenseInfo,
  PanelPluginMeta,
  systemDateFormats,
  SystemDateFormatSettings,
} from '@grafana/data';

export class GrafanaBootConfig implements GrafanaConfig {
  datasources: { [str: string]: DataSourceInstanceSettings } = {};
  panels: { [key: string]: PanelPluginMeta } = {};
  minRefreshInterval = '';
  appUrl = '';
  appSubUrl = '';
  windowTitlePrefix = '';
  buildInfo: BuildInfo = {} as BuildInfo;
  newPanelTitle = '';
  bootData: any;
  externalUserMngLinkUrl = '';
  externalUserMngLinkName = '';
  externalUserMngInfo = '';
  allowOrgCreate = false;
  disableLoginForm = false;
  defaultDatasource = '';
  alertingEnabled = false;
  alertingErrorOrTimeout = '';
  alertingNoDataOrNullValues = '';
  alertingMinInterval = 1;
  authProxyEnabled = false;
  exploreEnabled = false;
  ldapEnabled = false;
  sigV4AuthEnabled = false;
  samlEnabled = false;
  autoAssignOrg = true;
  verifyEmailEnabled = false;
  oauth: any;
  disableUserSignUp = false;
  loginHint: any;
  passwordHint: any;
  loginError: any;
  navTree: any;
  viewersCanEdit = false;
  editorsCanAdmin = false;
  disableSanitizeHtml = false;
  theme: GrafanaTheme;
  pluginsToPreload: string[] = [];
  featureToggles: FeatureToggles = {
    live: false,
    expressions: false,
    meta: false,
    ngalert: false,
    traceToLogs: false,
  };
  licenseInfo: LicenseInfo = {} as LicenseInfo;
  rendererAvailable = false;
  http2Enabled = false;
  dateFormats?: SystemDateFormatSettings;
  marketplaceUrl?: string;

  constructor(options: GrafanaBootConfig) {
    this.theme = options.bootData.user.lightTheme ? getTheme(GrafanaThemeType.Light) : getTheme(GrafanaThemeType.Dark);

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
        version: 'v1.0',
        commit: '1',
        env: 'production',
        isEnterprise: false,
      },
      viewersCanEdit: false,
      editorsCanAdmin: false,
      disableSanitizeHtml: false,
    };

    merge(this, defaults, options);

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
