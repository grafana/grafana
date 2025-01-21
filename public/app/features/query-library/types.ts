import { DataQuery } from '@grafana/schema';

export type DataQueryTarget = {
  variables: object; // TODO: Detect variables in #86838
  properties: DataQuery;
};

export type DataQuerySpec = {
  title: string;
  vars: object[]; // TODO: Detect variables in #86838
  targets: DataQueryTarget[];
};

export type DataQueryPartialSpec = Partial<DataQuerySpec>;

export type QueryTemplate = {
  uid: string;
  title: string;
  targets: DataQuery[];
  createdAtTimestamp: number;
  user?: User;
};

export type AddQueryTemplateCommand = {
  title: string;
  targets: DataQuery[];
};

export type EditQueryTemplateCommand = {
  uid: string;
  partialSpec: DataQueryPartialSpec;
};

export type DeleteQueryTemplateCommand = {
  uid: string;
};

export type User = {
  uid: string;
  displayName?: string;
  avatarUrl?: string;
};
