import {
  DataFrameJSON,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  PluginMeta,
} from '@grafana/data';
import { BackendSrv, BackendSrvRequest } from '@grafana/runtime';

import { SandboxQuery } from './sandbox_datasource';

export type SandboxGrafanaBootData = {
  id: string;
  meta: PluginMeta;
  instanceSettings?: DataSourceInstanceSettings;
  isSandbox: boolean;
  isDev: boolean;
  modulePath: string;
};

export enum SandboxMessageType {
  Handshake = 'handshake',
  Init = 'init',
  DatasourceQuery = 'datasource-query',
  DatasourceQueryResponse = 'datasource-query-response',
  DatasourceBackendSrvRequest = 'datasource-backend-srv-request',
  Error = 'error',
  Empty = 'empty',
}

export type SandboxHandshakeMessage = {
  type: SandboxMessageType.Handshake;
  id?: string;
};

export type SandboxInitMessage = {
  type: SandboxMessageType.Init;
  id: string;
};

export type SandboxDatasourceQueryMessage = {
  type: SandboxMessageType.DatasourceQuery;
  options: SandboxDataQueryRequest;
};

export type SandboxDataQueryRequest = Omit<DataQueryRequest<SandboxQuery>, 'range'> & {
  range: {
    from: string;
    to: string;
    raw: {
      from: string;
      to: string;
    };
  };
};

export type SandboxDatasourceQueryResponse = {
  type: SandboxMessageType.DatasourceQueryResponse;
  // the observable is not serializable
  payload: SandboxDatasourceDataQueryResponse;
};

export type SandboxDatasourceDataQueryResponse = Omit<DataQueryResponse, 'data'> & {
  data: DataFrameJSON[];
};

export type SandboxErrorMessage = {
  type: SandboxMessageType.Error;
  payload: Error;
};

export type SandboxDatasourceBackendSrvRequest = {
  type: SandboxMessageType.DatasourceBackendSrvRequest;
  payload: BackendSrvRequest;
};

export type SandboxEmptyMessage = {
  type: SandboxMessageType.Empty;
};

export type SandboxMessage =
  | SandboxDatasourceQueryMessage
  | SandboxErrorMessage
  | SandboxHandshakeMessage
  | SandboxDatasourceQueryResponse
  | SandboxDatasourceBackendSrvRequest
  | SandboxInitMessage
  | SandboxHandshakeMessage
  | SandboxEmptyMessage
  | SandboxErrorMessage;

export type SandboxGrafanaRunTime = {
  getBackendSrv: () => Partial<BackendSrv>;
};
