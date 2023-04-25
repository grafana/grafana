import { SelectableValue } from '@grafana/data';

import { DBClusterService } from '../../DBCluster.service';

export const RestoreService = {
  async loadSecretsNames(k8sClusterName: string): Promise<Array<SelectableValue<string>>> {
    const secretsResponse = await DBClusterService.getDBClusterSecrets(k8sClusterName);
    const secrets = secretsResponse?.secrets || [];
    return secrets.map((secret) => ({
      label: secret.name,
      value: secret.name,
    }));
  },
};
