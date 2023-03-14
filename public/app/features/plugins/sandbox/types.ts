import { Observable } from 'rxjs';

import {
  DataFrameJSON,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  PluginMeta,
} from '@grafana/data';

import { SandboxQuery } from './sandbox_datasource';

export type SandboxGrafanaBootData = {
  id: string;
  meta: PluginMeta;
  instanceSettings?: DataSourceInstanceSettings;
  isSandbox: boolean;
  isDev: boolean;
  modulePath: string;
};

export type SandboxMessageWrapper = {
  message: SandboxMessage;
  uid: string;
};

export enum SandboxMessageType {
  Handshake = 'handshake',
  Init = 'init',
  DatasourceQuery = 'datasource-query',
  DatasourceQueryResponse = 'datasource-query-response',
  Error = 'error',
}

export type SandboxHandshakeMessage = {
  type: SandboxMessageType.Handshake;
  uid?: string;
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

export type SandboxMessage =
  | SandboxDatasourceQueryMessage
  | SandboxErrorMessage
  | SandboxHandshakeMessage
  | SandboxDatasourceQueryResponse;
