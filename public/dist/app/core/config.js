import _ from 'lodash';
import { getTheme, GrafanaThemeType } from '@grafana/ui';
var Settings = /** @class */ (function () {
    function Settings(options) {
        this.theme = options.bootData.user.lightTheme ? getTheme(GrafanaThemeType.Light) : getTheme(GrafanaThemeType.Dark);
        var defaults = {
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
            editorsCanOwn: false,
            disableSanitizeHtml: false,
        };
        _.extend(this, defaults, options);
    }
    return Settings;
}());
export { Settings };
var bootData = window.grafanaBootData || {
    settings: {},
    user: {},
};
var options = bootData.settings;
options.bootData = bootData;
export var config = new Settings(options);
export default config;
//# sourceMappingURL=config.js.map