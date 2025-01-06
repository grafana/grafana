import { DataQuery } from '@grafana/schema/dist/esm/index';

export type DataQueryTarget = {
  variables: object; // TODO: Detect variables in #86838
  properties: DataQuery;
};

export type DataQuerySpec = {
  title: string;
  vars: object[]; // TODO: Detect variables in #86838
  targets: DataQueryTarget[];
};

export type DataQueryFullSpec = {
  apiVersion: string;
  kind: string;
  metadata: {
    generateName: string;
    name?: string;
    creationTimestamp?: string;
    annotations?: { [key: string]: string };
  };
  spec: DataQuerySpec;
};

export type DataQueryPartialSpec = Partial<DataQuerySpec>;

export type DataQuerySpecResponse = {
  apiVersion: string;
  items: DataQueryFullSpec[];
};

// pkg/apis/iam/v0alpha1/types_display.go
export type UserDataQueryResponse = {
  apiVersion: string;
  kind: string;
  metadata: {
    selfLink: string;
    resourceVersion: string;
    continue: string;
    remainingItemCount: number;
  };
  display: UserSpecResponse[];
  keys: string[];
};

// pkg/apis/iam/v0alpha1/types_display.go
export type UserSpecResponse = {
  avatarUrl: string;
  displayName: string;
  identity: {
    name: string;
    type: string;
  };
  internalId: number;
};

export const CREATED_BY_KEY = 'grafana.app/createdBy';
