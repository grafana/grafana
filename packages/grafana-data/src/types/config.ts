import { DataSourceInstanceSettings } from './datasource';
import { PanelPluginMeta } from './panel';
import { GrafanaTheme } from './theme';

/**
 * Describes the build information that will be available via the Grafana configuration.
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
export interface GrafanaConfig {
  datasources: { [str: string]: DataSourceInstanceSettings };
  panels: { [key: string]: PanelPluginMeta };
  minRefreshInterval: string;
  appSubUrl: string;
  windowTitlePrefix: string;
  buildInfo: BuildInfo;
  newPanelTitle: string;
  bootData: any;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  allowOrgCreate: boolean;
  disableLoginForm: boolean;
  defaultDatasource: string;
  alertingEnabled: boolean;
  alertingErrorOrTimeout: string;
  alertingNoDataOrNullValues: string;
  alertingMinInterval: number;
  authProxyEnabled: boolean;
  exploreEnabled: boolean;
  ldapEnabled: boolean;
  samlEnabled: boolean;
  autoAssignOrg: boolean;
  verifyEmailEnabled: boolean;
  oauth: any;
  disableUserSignUp: boolean;
  loginHint: any;
  passwordHint: any;
  loginError: any;
  navTree: any;
  viewersCanEdit: boolean;
  editorsCanAdmin: boolean;
  disableSanitizeHtml: boolean;
  theme: GrafanaTheme;
  pluginsToPreload: string[];
  featureToggles: FeatureToggles;
  licenseInfo: LicenseInfo;
}
