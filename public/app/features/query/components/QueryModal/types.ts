import { DataQuery } from '@grafana/data';

export interface QueryModalModel {
  title: string;
  body: QueryModalBody;
}

export interface QueryModalBodyProps {
  query?: DataQuery;
  onAddQuery?: (q: DataQuery) => void;
}

export type QueryModalBody = React.ComponentType<QueryModalBodyProps>;
