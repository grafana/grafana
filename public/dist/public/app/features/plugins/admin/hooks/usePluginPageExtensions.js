import React from 'react';
import { PluginActions } from '../components/PluginActions';
import { PluginSubtitle } from '../components/PluginSubtitle';
import { usePluginInfo } from './usePluginInfo';
export const usePluginPageExtensions = (plugin) => {
    const info = usePluginInfo(plugin);
    return {
        actions: React.createElement(PluginActions, { plugin: plugin }),
        info,
        subtitle: React.createElement(PluginSubtitle, { plugin: plugin }),
    };
};
//# sourceMappingURL=usePluginPageExtensions.js.map