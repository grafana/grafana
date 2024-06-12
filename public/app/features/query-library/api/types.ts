import { DataQuery } from '@grafana/schema/dist/esm/index';

export type DataQueryTarget = {
  variables: object; // TODO: Detect variables in #86838
  properties: DataQuery;
};

export type DataQuerySpec = {
  apiVersion: string;
  kind: string;
  metadata: {
    generateName: string;
    name?: string;
    creationTimestamp?: string;
    annotations?: { [key: string]: string };
  };
  spec: {
    title: string;
    vars: object[]; // TODO: Detect variables in #86838
    targets: DataQueryTarget[];
  };
};

export type DataQuerySpecResponse = {
  apiVersion: string;
  items: DataQuerySpec[];
};

export type User = {
  userId?: string;
  login?: string;
};

export const CREATED_BY_KEY = 'grafana.app/createdBy';
