import { useAsync } from 'react-use';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';
export function usePluginBridge(plugin) {
    const { loading, error, value } = useAsync(() => getPluginSettings(plugin, { showErrorAlert: false }));
    const installed = value && !error && !loading;
    const enabled = value === null || value === void 0 ? void 0 : value.enabled;
    const isLoading = loading && !value;
    if (isLoading) {
        return { loading: true };
    }
    if (!installed || !enabled) {
        return { loading: false, installed: false };
    }
    return { loading, installed: true, settings: value };
}
//# sourceMappingURL=usePluginBridge.js.map