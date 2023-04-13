import { SelectableValue } from '@grafana/data';

import { DBClusterService } from '../../DBCluster.service';
import { DBaaSBackupService } from '../DBaaSBackups/DBaaSBackups.service';

export const RestoreService = {
  async loadBackupArtifacts(locationId: string): Promise<Array<SelectableValue<string>>> {
    const backupArtifactsResponse = await DBaaSBackupService.list(locationId);

    return backupArtifactsResponse.map((backup) => ({
      label: backup.key,
      value: backup.key,
    }));
  },

  async loadSecretsNames(k8sClusterName: string): Promise<Array<SelectableValue<string>>> {
    const secretsResponse = await DBClusterService.getDBClusterSecrets(k8sClusterName);
    const secrets = secretsResponse?.secrets || [];
    return secrets.map((secret) => ({
      label: secret.name,
      value: secret.name,
    }));
  },
};
