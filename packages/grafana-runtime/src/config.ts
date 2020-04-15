import merge from 'lodash/merge';
import { getTheme } from '@grafana/ui';
import { DataSourceInstanceSettings, GrafanaTheme, GrafanaThemeType, PanelPluginMeta } from '@grafana/data';

/**
 * Describes the build information that will be available via the Grafana cofiguration.
 *
 * @public
 */
export interface BuildInfo {
  version: string;
  commit: string;
  /**
   * Is set to true when running Grafana Enterprise edition.
   *
   * @deprecated use `licenseInfo.hasLicense` instead
   */
  isEnterprise: boolean;
  env: string;
  edition: string;
  latestVersion: string;
  hasUpdate: boolean;
}

/**
 * Describes available feature toggles in Grafana. These can be configured via the
 * `conf/custom.ini` to enable features under development or not yet available in
 * stable version.
 *
 * @public
 */
export interface FeatureToggles {
  transformations: boolean;
  expressions: boolean;
  newEdit: boolean;
  /**
   * @remarks
   * Available only in Grafana Enterprise
   */
  meta: boolean;
  newVariables: boolean;
  tracingIntegration: boolean;
}

/**
 * Describes the license information about the current running instance of Grafana.
 *
 * @public
 */
export interface LicenseInfo {
  hasLicense: boolean;
  expiry: number;
  licenseUrl: string;
  stateInfo: string;
}

/**
 * Describes all the different Grafana configuration values available for an instance.
 *
 * @public
 */
export class GrafanaBootConfig {
  datasources: { [str: string]: DataSourceInstanceSettings } = {};
  panels: { [key: string]: PanelPluginMeta } = {};
  minRefreshInterval = '';
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
    transformations: false,
    expressions: false,
    newEdit: false,
    meta: false,
    newVariables: true,
    tracingIntegration: false,
  };
  licenseInfo: LicenseInfo = {} as LicenseInfo;

  constructor(options: GrafanaBootConfig) {
    this.theme = options.bootData.user.lightTheme ? getTheme(GrafanaThemeType.Light) : getTheme(GrafanaThemeType.Dark);

    const defaults = {
      datasources: {},
      windowTitlePrefix: 'Grafana - ',
      panels: {},
      newPanelTitle: 'Panel Title',
      playlist_timespan: '1m',
      unsaved_changes_warning: true,
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
