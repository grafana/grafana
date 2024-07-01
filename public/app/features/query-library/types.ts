import { DataQuery } from '@grafana/schema';

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

export interface EditQueryTemplateCommand extends AddQueryTemplateCommand {
  uid: string;
}

export type DeleteQueryTemplateCommand = {
  uid: string;
};
