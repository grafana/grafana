import { QueryResultMetaNotice, SelectableValue } from '@grafana/data';

export enum StorageView {
  Data = 'data',
  Config = 'config',
  Perms = 'perms',
  Export = 'export',
  History = 'history',
  AddRoot = 'add',
}

export interface UploadReponse {
  status: number;
  statusText: string;

  err?: boolean;
  message: string;
  path: string;
}

export interface StorageInfo {
  editable?: boolean;
  builtin?: boolean;
  ready?: boolean;
  notice?: QueryResultMetaNotice[];
  config: StorageConfig;
}

export interface StorageConfig {
  type: string;
  prefix: string;
  name: string;
  description: string;
  underContentRoot: string;
  disk?: {
    path: string;
  };
  git?: {
    remote: string;
    branch: string;
    root: string;
    requirePullRequest: boolean;
    accessToken: string;
  };
  sql?: {};
}

export enum WorkflowID {
  Save = 'save',
  PR = 'pr',
  Push = 'push',
}

export interface WriteValueRequest {
  kind: string;
  body: {}; // json body
  message?: string;
  title?: string;
  workflow: WorkflowID;
}

export interface WriteValueResponse {
  code: number;
  message?: string;
  url?: string;
  hash?: string;
  branch?: string;
  pending?: boolean;
  size?: number;
}

export interface ItemOptions {
  path: string;
  workflows: Array<SelectableValue<WorkflowID>>;
}
