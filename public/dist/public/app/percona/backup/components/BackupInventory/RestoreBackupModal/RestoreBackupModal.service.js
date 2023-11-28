import { __awaiter } from "tslib";
import { BackupInventoryService } from '../BackupInventory.service';
export const RestoreBackupModalService = {
    loadLocationOptions(artifactId) {
        return __awaiter(this, void 0, void 0, function* () {
            const services = yield BackupInventoryService.listCompatibleServices(artifactId);
            const result = [];
            Object.keys(services).forEach((db) => {
                const serviceArr = services[db] || [];
                result.push(...serviceArr.map((service) => ({ label: service.name, value: service.id })));
            });
            return result;
        });
    },
};
//# sourceMappingURL=RestoreBackupModal.service.js.map