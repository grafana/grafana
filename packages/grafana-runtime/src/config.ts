import extend from 'lodash/extend';
import { GrafanaTheme, getTheme, GrafanaThemeType, PanelPluginMeta, DataSourceInstanceSettings } from '@grafana/ui';

export interface BuildInfo {
  version: string;
  commit: string;
  isEnterprise: boolean;
  env: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export class Settings {
  datasources: { [str: string]: DataSourceInstanceSettings } = {};
  panels: { [key: string]: PanelPluginMeta } = {};
  appSubUrl: string = '';
  windowTitlePrefix: string = '';
  buildInfo: BuildInfo = {} as BuildInfo;
  newPanelTitle: string = '';
  bootData: any;
  externalUserMngLinkUrl: string = '';
  externalUserMngLinkName: string = '';
  externalUserMngInfo: string = '';
  allowOrgCreate: boolean = false;
  disableLoginForm: boolean = false;
  defaultDatasource: string = '';
  alertingEnabled: boolean = false;
  alertingErrorOrTimeout: string = '';
  alertingNoDataOrNullValues: string = '';
  authProxyEnabled: boolean = false;
  exploreEnabled: boolean = false;
  ldapEnabled: boolean = false;
  oauth: any;
  disableUserSignUp: boolean = false;
  loginHint: any;
  passwordHint: any;
  loginError: any;
  viewersCanEdit: boolean = false;
  editorsCanAdmin: boolean = false;
  disableSanitizeHtml: boolean = false;
  theme: GrafanaTheme;
  pluginsToPreload: string[] = [];

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
      editorsCanAdmin: false,
      disableSanitizeHtml: false,
    };

    extend(this, defaults, options);
  }
}

const bootData = (window as any).grafanaBootData || {
  settings: {},
  user: {},
};

const options = bootData.settings;
options.bootData = bootData;

export const config = new Settings(options);
