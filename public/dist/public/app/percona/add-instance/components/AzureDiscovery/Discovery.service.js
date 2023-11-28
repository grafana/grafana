import { __awaiter } from "tslib";
import { apiManagement } from 'app/percona/shared/helpers/api';
class DiscoveryService {
    static discoveryAzure({ azure_client_id, azure_client_secret, azure_tenant_id, azure_subscription_id }, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/azure/AzureDatabase/Discover', {
                azure_client_id,
                azure_client_secret,
                azure_tenant_id,
                azure_subscription_id,
            }, false, token);
        });
    }
}
export default DiscoveryService;
//# sourceMappingURL=Discovery.service.js.map