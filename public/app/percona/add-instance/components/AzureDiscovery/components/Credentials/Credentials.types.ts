import { SelectInstance } from 'app/percona/add-instance/panel.types';

export interface AzureCredentialsForm {
  azure_client_id?: string;
  azure_client_secret?: string;
  azure_tenant_id?: string;
  azure_subscription_id?: string;
  azure_resource_group?: string;
  azure_database_exporter?: boolean;
}

export interface CredentialsProps {
  onSetCredentials: (credentials: AzureCredentialsForm) => void;
  selectInstance: SelectInstance;
}
