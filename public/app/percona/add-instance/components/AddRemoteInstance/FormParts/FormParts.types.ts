import { InstanceTypes, RemoteInstanceCredentials } from 'app/percona/add-instance/panel.types';
import { FormApi } from 'final-form';

export interface MainDetailsFormPartProps {
  remoteInstanceCredentials: RemoteInstanceCredentials;
}

export interface FormPartProps {
  form: FormApi;
}

export interface AdditionalOptionsFormPartProps {
  instanceType: InstanceTypes;
  loading: boolean;
  remoteInstanceCredentials: RemoteInstanceCredentials;
  form: FormApi;
}

export interface PostgreSQLAdditionalOptionsProps {
  isRDS?: boolean;
  isAzure?: boolean;
}
