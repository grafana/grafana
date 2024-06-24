import { DataQuery } from '@grafana/schema';

import { User } from './api/types';

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

export type DeleteQueryTemplateCommand = {
  uid: string;
};
