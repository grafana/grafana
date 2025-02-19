import { StoreState } from 'app/types';

export function selectSecretsManagementIsLoading({ secretsManagementAdmin }: StoreState) {
  return secretsManagementAdmin.isLoading ?? false;
}

export function selectSecretsManagementSecrets({ secretsManagementAdmin }: StoreState) {
  return secretsManagementAdmin.secrets ?? [];
}

export function createSelectSecretsManagementSecretByName(name?: string) {
  return ({ secretsManagementAdmin }: StoreState) =>
    secretsManagementAdmin.secrets.find((secret) => secret.name === name);
}
