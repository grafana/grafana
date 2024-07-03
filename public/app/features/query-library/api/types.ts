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

// TODO : change put in API to PATCH and use DataQuerySpec instead of the full spec to try to not have shenanigans

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

export const CREATED_BY_KEY = 'grafana.app/createdBy';
