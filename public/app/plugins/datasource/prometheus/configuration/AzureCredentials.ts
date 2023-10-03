import { SelectableValue } from '@grafana/data';

export enum AzureCloud {
  Public = 'AzureCloud',
  China = 'AzureChinaCloud',
  USGovernment = 'AzureUSGovernment',
  None = '',
}

export const KnownAzureClouds: Array<SelectableValue<AzureCloud>> = [
  { value: AzureCloud.Public, label: 'Azure' },
  { value: AzureCloud.China, label: 'Azure China' },
  { value: AzureCloud.USGovernment, label: 'Azure US Government' },
];

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
