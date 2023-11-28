import React from 'react';
import { usePluginBridge } from '../hooks/usePluginBridge';
export const PluginBridge = ({ children, plugin, loadingComponent, notInstalledFallback, }) => {
    const { loading, installed } = usePluginBridge(plugin);
    if (loading) {
        return loadingComponent !== null && loadingComponent !== void 0 ? loadingComponent : null;
    }
    if (!installed) {
        return notInstalledFallback !== null && notInstalledFallback !== void 0 ? notInstalledFallback : null;
    }
    return React.createElement(React.Fragment, null, children);
};
export function createBridgeURL(plugin, path, options) {
    const searchParams = new URLSearchParams(options).toString();
    const pluginPath = `/a/${plugin}${path}`;
    return pluginPath + (searchParams ? '?' + searchParams : '');
}
//# sourceMappingURL=PluginBridge.js.map