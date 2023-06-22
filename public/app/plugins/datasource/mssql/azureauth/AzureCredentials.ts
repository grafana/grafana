import { SelectableValue } from '@grafana/data';

import { AzureCredentialsType } from '../../mssql/types';

export enum AzureCloud {
  Public = 'AzureCloud',
  None = '',
}

export const KnownAzureClouds: Array<SelectableValue<AzureCloud>> = [{ value: AzureCloud.Public, label: 'Azure' }];

export function isCredentialsComplete(credentials: AzureCredentialsType): boolean {
  switch (credentials.authType) {
    case 'msi':
      return true;
    case 'clientsecret':
      return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
  }
}
