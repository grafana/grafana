import { DataQuery } from '@grafana/schema';

import { DataQuerySpec } from './api/types';

export type QueryTemplate = {
  uid: string;
  title: string;
  targets: DataQuery[];
  createdAtTimestamp: number;
  user?: string;
  fullSpec: DataQuerySpec;
};

export type AddQueryTemplateCommand = {
  title: string;
  targets: DataQuery[];
};

export type DeleteQueryTemplateCommand = {
  uid: string;
};
