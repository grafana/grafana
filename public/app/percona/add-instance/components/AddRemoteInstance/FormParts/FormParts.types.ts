import { FormApi } from 'final-form';

import { InstanceAvailableType, RemoteInstanceCredentials } from 'app/percona/add-instance/panel.types';

export interface MainDetailsFormPartProps {
  remoteInstanceCredentials: RemoteInstanceCredentials;
  form?: FormApi;
}

export interface FormPartProps {
  form: FormApi;
}

export interface AdditionalOptionsFormPartProps {
  instanceType: InstanceAvailableType;
  loading: boolean;
  remoteInstanceCredentials: RemoteInstanceCredentials;
  form: FormApi;
}

export interface PostgreSQLAdditionalOptionsProps {
  isRDS?: boolean;
  isAzure?: boolean;
  form: FormApi;
}

export enum Schema {
  HTTP = 'http',
  HTTPS = 'https',
}

export enum MetricsParameters {
  manually = 'manually',
  parsed = 'parsed',
}
