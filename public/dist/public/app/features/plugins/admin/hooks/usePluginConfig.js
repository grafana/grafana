import { __awaiter, __generator } from "tslib";
import { useAsync } from 'react-use';
import { loadPlugin } from '../../PluginPage';
export var usePluginConfig = function (plugin) {
    return useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!plugin) {
                return [2 /*return*/, null];
            }
            if (plugin.isInstalled && !plugin.isDisabled) {
                return [2 /*return*/, loadPlugin(plugin.id)];
            }
            return [2 /*return*/, null];
        });
    }); }, [plugin === null || plugin === void 0 ? void 0 : plugin.id, plugin === null || plugin === void 0 ? void 0 : plugin.isInstalled, plugin === null || plugin === void 0 ? void 0 : plugin.isDisabled]);
};
//# sourceMappingURL=usePluginConfig.js.map