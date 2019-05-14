import * as tslib_1 from "tslib";
import React from 'react';
import config from 'app/core/config';
import { GrafanaThemeType, ThemeContext, getTheme } from '@grafana/ui';
export var ConfigContext = React.createContext(config);
export var ConfigConsumer = ConfigContext.Consumer;
export var provideConfig = function (component) {
    var ConfigProvider = function (props) { return (React.createElement(ConfigContext.Provider, { value: config }, React.createElement(component, tslib_1.__assign({}, props)))); };
    return ConfigProvider;
};
export var getCurrentThemeName = function () {
    return config.bootData.user.lightTheme ? GrafanaThemeType.Light : GrafanaThemeType.Dark;
};
export var getCurrentTheme = function () { return getTheme(getCurrentThemeName()); };
export var ThemeProvider = function (_a) {
    var children = _a.children;
    return (React.createElement(ConfigConsumer, null, function (config) {
        return React.createElement(ThemeContext.Provider, { value: getCurrentTheme() }, children);
    }));
};
export var provideTheme = function (component) {
    return provideConfig(function (props) { return React.createElement(ThemeProvider, null, React.createElement(component, tslib_1.__assign({}, props))); });
};
//# sourceMappingURL=ConfigProvider.js.map