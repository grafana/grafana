import { DataQuery } from '@grafana/schema';

export type OnSelectQueryType = (query: DataQuery) => void;

export type QueryLibraryEventsPropertyMap = Record<string, string | boolean | undefined>;
