import _ from 'lodash';

export interface BuildInfo {
  version: string;
  commit: string;
  isEnterprise: boolean;
  env: string;
}

export class Settings {
  datasources: any;
  panels: any;
  appSubUrl: string;
  window_title_prefix: string;
  buildInfo: BuildInfo;
  new_panel_title: string;
  bootData: any;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  allowOrgCreate: boolean;
  disableLoginForm: boolean;
  defaultDatasource: string;
  alertingEnabled: boolean;
  authProxyEnabled: boolean;
  exploreEnabled: boolean;
  ldapEnabled: boolean;
  oauth: any;
  disableUserSignUp: boolean;
  loginHint: any;
  loginError: any;

  constructor(options) {
    var defaults = {
      datasources: {},
      window_title_prefix: 'Grafana - ',
      panels: {},
      new_panel_title: 'Panel Title',
      playlist_timespan: '1m',
      unsaved_changes_warning: true,
      appSubUrl: '',
      buildInfo: {
        version: 'v1.0',
        commit: '1',
        env: 'production',
        isEnterprise: false,
      },
    };

    _.extend(this, defaults, options);
  }
}

var bootData = (<any>window).grafanaBootData || { settings: {} };
var options = bootData.settings;
options.bootData = bootData;

const config = new Settings(options);
export default config;
