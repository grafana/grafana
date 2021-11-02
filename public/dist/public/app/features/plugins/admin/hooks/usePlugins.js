import { __awaiter, __generator, __values } from "tslib";
import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { api } from '../api';
import { mapLocalToCatalog, mapRemoteToCatalog, mapToCatalogPlugin } from '../helpers';
export function usePlugins() {
    var _this = this;
    var _a = useAsync(function () { return __awaiter(_this, void 0, void 0, function () {
        var remote, installed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, api.getRemotePlugins()];
                case 1:
                    remote = _a.sent();
                    return [4 /*yield*/, api.getInstalledPlugins()];
                case 2:
                    installed = _a.sent();
                    return [2 /*return*/, { remote: remote, installed: installed }];
            }
        });
    }); }, []), loading = _a.loading, value = _a.value, error = _a.error;
    var plugins = useMemo(function () {
        var e_1, _a, e_2, _b;
        var installed = (value === null || value === void 0 ? void 0 : value.installed) || [];
        var remote = (value === null || value === void 0 ? void 0 : value.remote) || [];
        var unique = {};
        try {
            for (var installed_1 = __values(installed), installed_1_1 = installed_1.next(); !installed_1_1.done; installed_1_1 = installed_1.next()) {
                var plugin = installed_1_1.value;
                unique[plugin.id] = mapLocalToCatalog(plugin);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (installed_1_1 && !installed_1_1.done && (_a = installed_1.return)) _a.call(installed_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var _loop_1 = function (plugin) {
            if (plugin.typeCode === 'renderer') {
                return "continue";
            }
            if (!Boolean(plugin.versionSignatureType)) {
                return "continue";
            }
            if (unique[plugin.slug]) {
                unique[plugin.slug] = mapToCatalogPlugin(installed.find(function (installedPlugin) { return installedPlugin.id === plugin.slug; }), plugin);
            }
            else {
                unique[plugin.slug] = mapRemoteToCatalog(plugin);
            }
        };
        try {
            for (var remote_1 = __values(remote), remote_1_1 = remote_1.next(); !remote_1_1.done; remote_1_1 = remote_1.next()) {
                var plugin = remote_1_1.value;
                _loop_1(plugin);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (remote_1_1 && !remote_1_1.done && (_b = remote_1.return)) _b.call(remote_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return Object.values(unique);
    }, [value === null || value === void 0 ? void 0 : value.installed, value === null || value === void 0 ? void 0 : value.remote]);
    return {
        loading: loading,
        error: error,
        plugins: plugins,
    };
}
//# sourceMappingURL=usePlugins.js.map