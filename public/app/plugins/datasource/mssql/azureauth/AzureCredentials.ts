import { SelectableValue } from '@grafana/data';

import { AzureCredentials } from '../../mssql/types';

export enum AzureCloud {
  Public = 'AzureCloud',
  None = '',
}

export const KnownAzureClouds: Array<SelectableValue<AzureCloud>> = [{ value: AzureCloud.Public, label: 'Azure' }];

export function isCredentialsComplete(credentials: AzureCredentials): boolean {
  switch (credentials.authType) {
    case 'msi':
      return true;
    case 'clientsecret':
      return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
  }
}
