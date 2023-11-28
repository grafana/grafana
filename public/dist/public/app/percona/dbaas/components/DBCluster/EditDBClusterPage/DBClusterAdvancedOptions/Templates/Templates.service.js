import { __awaiter } from "tslib";
import { DBClusterService } from '../../../DBCluster.service';
import { DatabaseToDBClusterTypeMapping } from '../../../DBCluster.types';
export const TemplatesService = {
    loadTemplatesOptions(k8sClusterName, databaseType) {
        return __awaiter(this, void 0, void 0, function* () {
            const dbClusterType = DatabaseToDBClusterTypeMapping[databaseType];
            const templatesResponse = dbClusterType && (yield DBClusterService.getDBClusterTemplates(k8sClusterName, dbClusterType));
            const templates = (templatesResponse === null || templatesResponse === void 0 ? void 0 : templatesResponse.templates) || [];
            return templates.map((template) => ({
                label: template.name,
                value: template.kind,
            }));
        });
    },
};
//# sourceMappingURL=Templates.service.js.map