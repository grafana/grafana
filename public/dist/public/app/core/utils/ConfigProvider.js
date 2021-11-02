import { __assign, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { config, ThemeChangedEvent } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';
import { appEvents } from '../core';
import { createTheme } from '@grafana/data';
export var ConfigContext = React.createContext(config);
export var ConfigConsumer = ConfigContext.Consumer;
export var provideConfig = function (component) {
    var ConfigProvider = function (props) { return (React.createElement(ConfigContext.Provider, { value: config }, React.createElement(component, __assign({}, props)))); };
    return ConfigProvider;
};
export var ThemeProvider = function (_a) {
    var children = _a.children;
    var _b = __read(useState(getCurrentUserTheme()), 2), theme = _b[0], setTheme = _b[1];
    useEffect(function () {
        var sub = appEvents.subscribe(ThemeChangedEvent, function (event) {
            //config.theme = event.payload;
            setTheme(event.payload);
        });
        return function () { return sub.unsubscribe(); };
    }, []);
    return React.createElement(ThemeContext.Provider, { value: theme }, children);
};
function getCurrentUserTheme() {
    return createTheme({
        colors: {
            mode: config.bootData.user.lightTheme ? 'light' : 'dark',
        },
    });
}
export var provideTheme = function (component) {
    return provideConfig(function (props) { return React.createElement(ThemeProvider, null, React.createElement(component, __assign({}, props))); });
};
//# sourceMappingURL=ConfigProvider.js.map