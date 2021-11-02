import { __assign, __awaiter, __generator, __read } from "tslib";
import { useEffect, useState } from 'react';
import { isGUIDish } from '../ResourcePicker/utils';
function migrateWorkspaceQueryToResourceQuery(datasource, query, onChange) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var isWorkspaceGUID, resource, newQuery;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(((_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.workspace) !== undefined && !query.azureLogAnalytics.resource)) return [3 /*break*/, 4];
                    isWorkspaceGUID = isGUIDish(query.azureLogAnalytics.workspace);
                    resource = void 0;
                    if (!isWorkspaceGUID) return [3 /*break*/, 2];
                    return [4 /*yield*/, datasource.resourcePickerData.getResourceURIFromWorkspace(query.azureLogAnalytics.workspace)];
                case 1:
                    resource = _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    // The value of workspace is probably a template variable so we just migrate it over as-is
                    resource = query.azureLogAnalytics.workspace;
                    _b.label = 3;
                case 3:
                    newQuery = __assign(__assign({}, query), { azureLogAnalytics: __assign(__assign({}, query.azureLogAnalytics), { resource: resource, workspace: undefined }) });
                    delete newQuery.azureLogAnalytics.workspace;
                    onChange(newQuery);
                    _b.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
export default function useMigrations(datasource, query, onChange) {
    var _a = __read(useState(), 2), migrationError = _a[0], setMigrationError = _a[1];
    useEffect(function () {
        migrateWorkspaceQueryToResourceQuery(datasource, query, onChange).catch(function (err) {
            return setMigrationError({
                title: 'Unable to migrate workspace as a resource',
                message: err.message,
            });
        });
    }, [datasource, query, onChange]);
    return migrationError;
}
//# sourceMappingURL=useMigrations.js.map