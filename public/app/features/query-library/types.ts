import { DataQuery } from '@grafana/schema/dist/esm/index';

export type QueryTemplate = {
  uid: string;
  title: string;
  targets: DataQuery[];
  createdAtTimestamp: number;
};
