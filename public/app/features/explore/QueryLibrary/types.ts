import { DataQuery } from '@grafana/schema';

export type OnSelectQueryType = (query: DataQuery) => void;
