import _ from 'lodash';

class Settings {
  datasources: any;
  panels: any;
  appSubUrl: string;
  window_title_prefix: string;
  buildInfo: any;
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
    };
    _.extend(this, defaults, options);
  }
}

var bootData = (<any>window).grafanaBootData || { settings: {} };
var options = bootData.settings;
options.bootData = bootData;

const config = new Settings(options);
export default config;
