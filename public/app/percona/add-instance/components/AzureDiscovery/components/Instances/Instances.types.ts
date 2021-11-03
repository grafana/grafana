import { Instance } from '../../Discovery.types';
import { AzureCredentialsForm } from '../Credentials/Credentials.types';
import { SelectInstance } from 'app/percona/add-instance/panel.types';

export type AzureCredentials = AzureCredentialsForm & {
  isAzure?: boolean;
};

export interface InstancesTableProps {
  instances: Instance[];
  selectInstance: SelectInstance;
  loading: boolean;
  credentials: AzureCredentialsForm;
}
