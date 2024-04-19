import { DataQuery } from '@grafana/schema';

export type QueryTemplate = {
  uid: string;
  title: string;
  targets: DataQuery[];
  createdAt: string;
  spec: DataQuerySpec;
};

export type DataQueryTarget = {
  variables: Variables;
  properties: DataQuery;
};

type VariableKey = string;

export const VARIABLE_FORMATS = ['csv', 'json', 'doublequote', 'singlequote', 'pipe', 'raw'];
export type VariableFormat = 'csv' | 'json' | 'doublequote' | 'singlequote' | 'pipe' | 'raw';

export type VariableReplacement = {
  path: string;
  position: {
    start: number;
    end: number;
  };
  format: VariableFormat;
};

export type Variables = Record<VariableKey, VariableReplacement[]>;

export type ValueListDefinition = {
  customValues?: string;
};

export type VariableDefinition = {
  key: string;
  defaultValues: string[];
  valueListDefinition: ValueListDefinition | null;
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
    vars: VariableDefinition[];
    targets: DataQueryTarget[];
  };
};

export type DataQuerySpecResponse = {
  apiVersion: string;
  items: DataQuerySpec[];
};
