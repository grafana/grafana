import { __awaiter } from "tslib";
import { useEffect, useState } from 'react';
import { isGUIDish } from '../ResourcePicker/utils';
function migrateWorkspaceQueryToResourceQuery(datasource, query, onChange) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (((_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.workspace) !== undefined && !query.azureLogAnalytics.resources) {
            const isWorkspaceGUID = isGUIDish(query.azureLogAnalytics.workspace);
            let resource;
            if (isWorkspaceGUID) {
                resource = yield datasource.resourcePickerData.getResourceURIFromWorkspace(query.azureLogAnalytics.workspace);
            }
            else {
                // The value of workspace is probably a template variable so we just migrate it over as-is
                resource = query.azureLogAnalytics.workspace;
            }
            const newQuery = Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { resource: resource, workspace: undefined }) });
            delete newQuery.azureLogAnalytics.workspace;
            onChange(newQuery);
        }
    });
}
export default function useMigrations(datasource, query, onChange) {
    const [migrationError, setMigrationError] = useState();
    useEffect(() => {
        migrateWorkspaceQueryToResourceQuery(datasource, query, onChange).catch((err) => setMigrationError({
            title: 'Unable to migrate workspace as a resource',
            message: err.message,
        }));
    }, [datasource, query, onChange]);
    return migrationError;
}
//# sourceMappingURL=useMigrations.js.map