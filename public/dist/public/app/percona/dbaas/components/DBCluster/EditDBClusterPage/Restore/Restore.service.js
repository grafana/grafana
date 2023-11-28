import { __awaiter } from "tslib";
import { DBClusterService } from '../../DBCluster.service';
import { DBaaSBackupService } from '../DBaaSBackups/DBaaSBackups.service';
export const RestoreService = {
    loadBackupArtifacts(locationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const backupArtifactsResponse = yield DBaaSBackupService.list(locationId);
            return backupArtifactsResponse.map((backup) => ({
                label: backup.key,
                value: backup.key,
            }));
        });
    },
    loadSecretsNames(k8sClusterName) {
        return __awaiter(this, void 0, void 0, function* () {
            const secretsResponse = yield DBClusterService.getDBClusterSecrets(k8sClusterName);
            const secrets = (secretsResponse === null || secretsResponse === void 0 ? void 0 : secretsResponse.secrets) || [];
            return secrets.map((secret) => ({
                label: secret.name,
                value: secret.name,
            }));
        });
    },
};
//# sourceMappingURL=Restore.service.js.map