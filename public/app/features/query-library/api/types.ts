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
