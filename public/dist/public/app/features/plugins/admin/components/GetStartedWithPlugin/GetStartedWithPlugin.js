import React from 'react';
import { PluginType } from '@grafana/data';
import { GetStartedWithApp } from './GetStartedWithApp';
import { GetStartedWithDataSource } from './GetStartedWithDataSource';
export function GetStartedWithPlugin({ plugin }) {
    if (!plugin.isInstalled || plugin.isDisabled) {
        return null;
    }
    switch (plugin.type) {
        case PluginType.datasource:
            return React.createElement(GetStartedWithDataSource, { plugin: plugin });
        case PluginType.app:
            return React.createElement(GetStartedWithApp, { plugin: plugin });
        default:
            return null;
    }
}
//# sourceMappingURL=GetStartedWithPlugin.js.map