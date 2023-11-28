import { __awaiter } from "tslib";
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';
export const AddBackupPageService = {
    loadServiceOptions(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const supportedServices = [Databases.mysql, Databases.mongodb];
            const services = yield InventoryService.getDbServices();
            const result = [];
            // @ts-ignore
            Object.keys(services).forEach((serviceName) => {
                var _a;
                const newServices = (_a = services[serviceName]) !== null && _a !== void 0 ? _a : [];
                if (supportedServices.includes(serviceName)) {
                    result.push(...newServices
                        .filter((service) => service.name.toLowerCase().includes(query))
                        .map(({ id, name, cluster }) => ({
                        label: name,
                        value: { id, vendor: serviceName, cluster },
                    })));
                }
            });
            return result;
        });
    },
};
//# sourceMappingURL=AddBackupPage.service.js.map