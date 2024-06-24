import { DataQuery } from '@grafana/schema';

export type QueryTemplate = {
  uid: string;
  title: string;
  targets: DataQuery[];
  createdAtTimestamp: number;
};

export type AddQueryTemplateCommand = {
  title: string;
  targets: DataQuery[];
};

export type DeleteQueryTemplateCommand = {
  uid: string;
};
