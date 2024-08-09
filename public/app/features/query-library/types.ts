import { DataQuery } from '@grafana/schema';

import { DataQueryPartialSpec } from './api/types';

export type QueryTemplate = {
  uid: string;
  title: string;
  targets: DataQuery[];
  createdAtTimestamp: number;
  user?: string;
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
