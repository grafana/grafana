import { __awaiter } from "tslib";
import { KubernetesService } from '../../../../Kubernetes/Kubernetes.service';
export const ConfigurationService = {
    loadStorageClassOptions(k8sClusterName) {
        return __awaiter(this, void 0, void 0, function* () {
            const storageClassesResponse = yield KubernetesService.getStorageClasses(k8sClusterName);
            const storageClasses = (storageClassesResponse === null || storageClassesResponse === void 0 ? void 0 : storageClassesResponse.storage_classes) || [];
            return storageClasses.map((storageClass) => ({
                label: storageClass,
                value: storageClass,
            }));
        });
    },
};
//# sourceMappingURL=Configurations.service.js.map