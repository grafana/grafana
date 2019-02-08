import _ from 'lodash';
import { PanelPlugin } from 'app/types/plugins';
import { GrafanaTheme, getTheme, GrafanaThemeType } from '@grafana/ui';

export interface BuildInfo {
  version: string;
  commit: string;
  isEnterprise: boolean;
  env: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export class Settings {
  datasources: any;
  panels: PanelPlugin[];
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
  authProxyEnabled: boolean;
  exploreEnabled: boolean;
  ldapEnabled: boolean;
  oauth: any;
  disableUserSignUp: boolean;
  loginHint: any;
  loginError: any;
  viewersCanEdit: boolean;
  disableSanitizeHtml: boolean;
  theme: GrafanaTheme;

  constructor(options: Settings) {
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
      disableSanitizeHtml: false
    };

    _.extend(this, defaults, options);
  }
}

const bootData = (window as any).grafanaBootData || {
  settings: {},
  user: {},
};

const options = bootData.settings;
options.bootData = bootData;

export const config = new Settings(options);
export default config;
