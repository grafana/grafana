import { __assign, __read } from "tslib";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { applyFieldOverrides, getTimeZone } from '@grafana/data';
import { appEvents } from 'app/core/core';
import { useAsync } from 'react-use';
import { getPanelOptionsWithDefaults } from '../../dashboard/state/getPanelOptionsWithDefaults';
import { importPanelPlugin } from '../../plugins/importPanelPlugin';
import { ErrorBoundaryAlert, useTheme2 } from '@grafana/ui';
var defaultFieldConfig = { defaults: {}, overrides: [] };
export function PanelRenderer(props) {
    var pluginId = props.pluginId, data = props.data, _a = props.timeZone, timeZone = _a === void 0 ? getTimeZone() : _a, _b = props.options, options = _b === void 0 ? {} : _b, width = props.width, height = props.height, title = props.title, _c = props.onOptionsChange, onOptionsChange = _c === void 0 ? function () { } : _c, _d = props.onChangeTimeRange, onChangeTimeRange = _d === void 0 ? function () { } : _d, _e = props.fieldConfig, externalFieldConfig = _e === void 0 ? defaultFieldConfig : _e;
    var _f = __read(useState(externalFieldConfig), 2), localFieldConfig = _f[0], setFieldConfig = _f[1];
    var _g = useAsync(function () { return importPanelPlugin(pluginId); }, [pluginId]), plugin = _g.value, error = _g.error, loading = _g.loading;
    var optionsWithDefaults = useOptionDefaults(plugin, options, localFieldConfig);
    var dataWithOverrides = useFieldOverrides(plugin, optionsWithDefaults, data, timeZone);
    useEffect(function () {
        setFieldConfig(function (lfc) { return (__assign(__assign({}, lfc), externalFieldConfig)); });
    }, [externalFieldConfig]);
    if (error) {
        return React.createElement("div", null,
            "Failed to load plugin: ",
            error.message);
    }
    if (pluginIsLoading(loading, plugin, pluginId)) {
        return React.createElement("div", null, "Loading plugin panel...");
    }
    if (!plugin || !plugin.panel) {
        return React.createElement("div", null, "Seems like the plugin you are trying to load does not have a panel component.");
    }
    if (!dataWithOverrides) {
        return React.createElement("div", null, "No panel data");
    }
    var PanelComponent = plugin.panel;
    return (React.createElement(ErrorBoundaryAlert, { dependencies: [plugin, data] },
        React.createElement(PanelComponent, { id: 1, data: dataWithOverrides, title: title, timeRange: dataWithOverrides.timeRange, timeZone: timeZone, options: optionsWithDefaults.options, fieldConfig: localFieldConfig, transparent: false, width: width, height: height, renderCounter: 0, replaceVariables: function (str) { return str; }, onOptionsChange: onOptionsChange, onFieldConfigChange: setFieldConfig, onChangeTimeRange: onChangeTimeRange, eventBus: appEvents })));
}
function useOptionDefaults(plugin, options, fieldConfig) {
    return useMemo(function () {
        if (!plugin) {
            return;
        }
        return getPanelOptionsWithDefaults({
            plugin: plugin,
            currentOptions: options,
            currentFieldConfig: fieldConfig,
            isAfterPluginChange: false,
        });
    }, [plugin, fieldConfig, options]);
}
function useFieldOverrides(plugin, defaultOptions, data, timeZone) {
    var fieldConfig = defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.fieldConfig;
    var series = data === null || data === void 0 ? void 0 : data.series;
    var fieldConfigRegistry = plugin === null || plugin === void 0 ? void 0 : plugin.fieldConfigRegistry;
    var theme = useTheme2();
    var structureRev = useRef(0);
    return useMemo(function () {
        if (!fieldConfigRegistry || !fieldConfig || !data) {
            return;
        }
        structureRev.current = structureRev.current + 1;
        return __assign(__assign({}, data), { series: applyFieldOverrides({
                data: series,
                fieldConfig: fieldConfig,
                fieldConfigRegistry: fieldConfigRegistry,
                replaceVariables: function (str) { return str; },
                theme: theme,
                timeZone: timeZone,
            }), structureRev: structureRev.current });
    }, [fieldConfigRegistry, fieldConfig, data, series, timeZone, theme]);
}
function pluginIsLoading(loading, plugin, pluginId) {
    return loading || (plugin === null || plugin === void 0 ? void 0 : plugin.meta.id) !== pluginId;
}
//# sourceMappingURL=PanelRenderer.js.map