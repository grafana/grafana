import { __awaiter } from "tslib";
import { useAsync } from 'react-use';
import { loadPlugin } from '../../utils';
export const usePluginConfig = (plugin) => {
    return useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!plugin) {
            return null;
        }
        if (plugin.isInstalled && !plugin.isDisabled) {
            return loadPlugin(plugin.id);
        }
        return null;
    }), [plugin === null || plugin === void 0 ? void 0 : plugin.id, plugin === null || plugin === void 0 ? void 0 : plugin.isInstalled, plugin === null || plugin === void 0 ? void 0 : plugin.isDisabled]);
};
//# sourceMappingURL=usePluginConfig.js.map