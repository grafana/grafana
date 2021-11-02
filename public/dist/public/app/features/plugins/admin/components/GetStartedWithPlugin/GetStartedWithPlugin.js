import React from 'react';
import { PluginType } from '@grafana/data';
import { GetStartedWithDataSource } from './GetStartedWithDataSource';
export function GetStartedWithPlugin(_a) {
    var plugin = _a.plugin;
    if (!plugin.isInstalled || plugin.isDisabled) {
        return null;
    }
    switch (plugin.type) {
        case PluginType.datasource:
            return React.createElement(GetStartedWithDataSource, { plugin: plugin });
        default:
            return null;
    }
}
//# sourceMappingURL=GetStartedWithPlugin.js.map