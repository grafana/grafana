import { DataSourceInstanceSettings } from '@grafana/data';

export type SandboxGrafanaBootData = {
  instanceSettings: DataSourceInstanceSettings;
  isSandbox: boolean;
  isDev: boolean;
  modulePath: string;
};

export enum SandboxMessageType {
  Handshake = 'handshake',
  Init = 'init',
}

export type SandboxHandshakeMessage = {
  type: SandboxMessageType.Handshake;
  key: string;
  uid?: string;
};

export type SandboxInitMessage = {
  type: SandboxMessageType.Init;
  id: string;
};

export type SandboxMessage = SandboxHandshakeMessage | SandboxInitMessage;
