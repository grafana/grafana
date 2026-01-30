// Mock data factory for Secrets Keeper UI development
import { Keeper, KeeperListItem, KeeperType } from '../types';

/**
 * Create a mock keeper for testing/demo purposes
 */
export function createMockKeeper(
  name: string,
  type: KeeperType,
  description: string,
  isActive = false,
  config?: Partial<Keeper['spec']>
): Keeper {
  const baseKeeper: Keeper = {
    metadata: {
      name,
      namespace: 'default',
      creationTimestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      labels: {
        'app.kubernetes.io/managed-by': 'grafana',
      },
    },
    spec: {
      description,
      ...config,
    },
    isActive,
  };

  // Add type-specific config
  switch (type) {
    case 'aws':
      baseKeeper.spec.aws = config?.aws || {
        region: 'us-east-1',
        assumeRole: {
          assumeRoleArn: 'arn:aws:iam::123456789012:role/GrafanaSecretsRole',
          externalID: 'grafana-external-id',
        },
      };
      break;
    case 'azure':
      baseKeeper.spec.azure = config?.azure || {
        keyVaultName: 'grafana-secrets-vault',
        tenantID: 'tenant-uuid-here',
        clientID: 'client-uuid-here',
        clientSecret: {
          secureValueName: 'azure-client-secret',
        },
      };
      break;
    case 'gcp':
      baseKeeper.spec.gcp = config?.gcp || {
        projectID: 'grafana-prod',
        credentialsFile: '/etc/grafana/gcp-credentials.json',
      };
      break;
    case 'hashicorp':
      baseKeeper.spec.hashiCorpVault = config?.hashiCorpVault || {
        address: 'https://vault.company.com',
        token: {
          valueFromEnv: 'VAULT_TOKEN',
        },
      };
      break;
  }

  return baseKeeper;
}

/**
 * Convert a full Keeper object to a list item for display
 */
export function keeperToListItem(keeper: Keeper): KeeperListItem {
  // Determine type from spec
  let type: KeeperType = 'system';
  let config = '';

  if (keeper.spec.aws) {
    type = 'aws';
    config = keeper.spec.aws.region;
  } else if (keeper.spec.azure) {
    type = 'azure';
    config = keeper.spec.azure.keyVaultName;
  } else if (keeper.spec.gcp) {
    type = 'gcp';
    config = keeper.spec.gcp.projectID;
  } else if (keeper.spec.hashiCorpVault) {
    type = 'hashicorp';
    config = new URL(keeper.spec.hashiCorpVault.address).hostname;
  }

  return {
    name: keeper.metadata.name,
    type,
    description: keeper.spec.description,
    isActive: keeper.isActive || false,
    createdAt: keeper.metadata.creationTimestamp,
    config,
  };
}

/**
 * Mock data for development/demo
 */
export const MOCK_KEEPERS: Keeper[] = [
  createMockKeeper('aws-prod', 'aws', 'Production AWS Secrets Manager', true),
  createMockKeeper('aws-staging', 'aws', 'Staging AWS Secrets Manager', false, {
    aws: {
      region: 'us-west-2',
      accessKey: {
        accessKeyID: { secureValueName: 'aws-access-key-staging' },
        secretAccessKey: { secureValueName: 'aws-secret-key-staging' },
      },
    },
  }),
  createMockKeeper('azure-prod', 'azure', 'Production Azure Key Vault', false),
  createMockKeeper('vault-internal', 'hashicorp', 'Internal HashiCorp Vault', false),
];

/**
 * Mock list items for display
 */
export const MOCK_KEEPER_LIST: KeeperListItem[] = MOCK_KEEPERS.map(keeperToListItem);
