import { SelectInstance } from 'app/percona/add-instance/panel.types';

export interface RDSCredentialsForm {
  aws_access_key: string;
  aws_secret_key: string;
}

export interface CredentialsProps {
  discover: (credentials: RDSCredentialsForm) => void;
  selectInstance: SelectInstance;
}
