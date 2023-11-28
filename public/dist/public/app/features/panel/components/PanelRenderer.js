import React, { useState, useMemo, useEffect } from 'react';
import { getTimeZone, PluginContextProvider, getPanelOptionsWithDefaults, useFieldOverrides, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { ErrorBoundaryAlert, usePanelContext, useTheme2 } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { importPanelPlugin, syncGetPanelPlugin } from '../../plugins/importPanelPlugin';
const defaultFieldConfig = { defaults: {}, overrides: [] };
export function PanelRenderer(props) {
    const { pluginId, data, timeZone = getTimeZone(), options = {}, width, height, title, onOptionsChange = () => { }, onChangeTimeRange = () => { }, onFieldConfigChange = () => { }, fieldConfig = defaultFieldConfig, } = props;
    const theme = useTheme2();
    const templateSrv = getTemplateSrv();
    const replace = useMemo(() => templateSrv.replace.bind(templateSrv), [templateSrv]);
    const [plugin, setPlugin] = useState(syncGetPanelPlugin(pluginId));
    const [error, setError] = useState();
    const optionsWithDefaults = useOptionDefaults(plugin, options, fieldConfig);
    const { dataLinkPostProcessor } = usePanelContext();
    const dataWithOverrides = useFieldOverrides(plugin, optionsWithDefaults === null || optionsWithDefaults === void 0 ? void 0 : optionsWithDefaults.fieldConfig, data, timeZone, theme, replace, dataLinkPostProcessor);
    useEffect(() => {
        // If we already have a plugin and it's correct one do nothing
        if (plugin && plugin.hasPluginId(pluginId)) {
            return;
        }
        // Async load the plugin
        importPanelPlugin(pluginId)
            .then((result) => setPlugin(result))
            .catch((err) => {
            setError(err.message);
        });
    }, [pluginId, plugin]);
    if (error) {
        return React.createElement("div", null,
            "Failed to load plugin: ",
            error);
    }
    if (!plugin || !plugin.hasPluginId(pluginId)) {
        return React.createElement("div", null, "Loading plugin panel...");
    }
    if (!plugin.panel) {
        return React.createElement("div", null, "Seems like the plugin you are trying to load does not have a panel component.");
    }
    if (!dataWithOverrides) {
        return React.createElement("div", null, "No panel data");
    }
    const PanelComponent = plugin.panel;
    return (React.createElement(ErrorBoundaryAlert, { dependencies: [plugin, data] },
        React.createElement(PluginContextProvider, { meta: plugin.meta },
            React.createElement(PanelComponent, { id: 1, data: dataWithOverrides, title: title, timeRange: dataWithOverrides.timeRange, timeZone: timeZone, options: optionsWithDefaults.options, fieldConfig: fieldConfig, transparent: false, width: width, height: height, renderCounter: 0, replaceVariables: (str) => str, onOptionsChange: onOptionsChange, onFieldConfigChange: onFieldConfigChange, onChangeTimeRange: onChangeTimeRange, eventBus: appEvents }))));
}
function useOptionDefaults(plugin, options, fieldConfig) {
    return useMemo(() => {
        if (!plugin) {
            return;
        }
        return getPanelOptionsWithDefaults({
            plugin,
            currentOptions: options,
            currentFieldConfig: fieldConfig,
            isAfterPluginChange: false,
        });
    }, [plugin, fieldConfig, options]);
}
//# sourceMappingURL=PanelRenderer.js.map