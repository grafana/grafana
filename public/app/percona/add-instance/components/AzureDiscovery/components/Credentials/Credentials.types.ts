export interface AzureCredentialsForm {
  azure_client_id?: string;
  azure_client_secret?: string;
  azure_tenant_id?: string;
  azure_subscription_id?: string;
}

export interface CredentialsProps {
  onSetCredentials: (credentials: AzureCredentialsForm) => void;
  selectInstance: (instance: any) => void;
}
