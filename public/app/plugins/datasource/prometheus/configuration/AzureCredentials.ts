export type AzureAuthType = 'msi' | 'clientsecret' | 'workloadidentity';

export type ConcealedSecret = symbol;

interface AzureCredentialsBase {
  authType: AzureAuthType;
  defaultSubscriptionId?: string;
}

export interface AzureManagedIdentityCredentials extends AzureCredentialsBase {
  authType: 'msi';
}

export interface AzureWorkloadIdentityCredentials extends AzureCredentialsBase {
  authType: 'workloadidentity';
}

export interface AzureClientSecretCredentials extends AzureCredentialsBase {
  authType: 'clientsecret';
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}

export type AzureCredentials =
  | AzureManagedIdentityCredentials
  | AzureClientSecretCredentials
  | AzureWorkloadIdentityCredentials;

export function isCredentialsComplete(credentials: AzureCredentials): boolean {
  switch (credentials.authType) {
    case 'msi':
    case 'workloadidentity':
      return true;
    case 'clientsecret':
      return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
  }
}
