import { DataQuery, DataSourceRef } from '@grafana/schema';

export type User = {
  uid: string;
  displayName?: string;
  avatarUrl?: string;
};

export type OnSelectQueryType = (query: DataQuery) => void;

export type QueryLibraryEventsPropertyMap = Record<string, string | boolean | undefined>;

export type QueryTemplate = {
  query: DataQuery;
  datasourceName?: string;
  title?: string;
  description?: string;
  tags?: string[];
  isLocked?: boolean;
  isVisible?: boolean;
  queryText?: string;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: User;
  uid?: string;
};
