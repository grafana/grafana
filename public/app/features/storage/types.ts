import { QueryResultMetaNotice } from '@grafana/data';

export interface RootStorageMeta {
  editable?: boolean;
  builtin?: boolean;
  ready: boolean;
  notice?: QueryResultMetaNotice[];
  config: RootStorageConfig;
}

export interface RootStorageConfig {
  type: string;
  prefix: string;
  name: string;
  disk?: StorageLocalDiskConfig;
  git?: StorageGitConfig;
  sql?: StorageSQLConfig;
  s3?: StorageS3Config;
}

export interface StorageLocalDiskConfig {
  path: string;
  roots?: string[];
}

export interface StorageGitConfig {
  remote: string;
  branch: string;
  root: string;
  accessToken?: string;
}

export interface StorageSQLConfig {
  // TODO: add sql config
}

export interface StorageS3Config {
  bucket: string;
  folder: string;
  accessKey: string;
  secretKey: string;
}

export interface StatusResponse {
  resources: RootStorageMeta[];
  dashboards: RootStorageMeta[];
  datasources?: RootStorageMeta[];
}
