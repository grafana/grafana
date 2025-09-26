import { DataQuery, DataSourceRef } from '@grafana/schema';

export type User = {
  uid: string;
  displayName?: string;
  avatarUrl?: string;
};

export type OnSelectQueryType = (query: DataQuery) => void;

export type QueryLibraryEventsPropertyMap = Record<string, string | boolean | undefined>;

// flattened data from API response to facilitate structs
export type SavedQueryBase = {
  uid: string;
  title: string;
  description: string;
  tags: string[];
  isLocked: boolean;
  isVisible: boolean;
  createdAtTimestamp: number;
  user: User;
  targets: DataQuery[];
};
// this should actually be like this, but not posssible due to enterprise Spec
// & Required<Pick<QuerySpec, 'title' | 'description' | 'tags' | 'isLocked' | 'isVisible'>>;

// our model of SavedQuery to use throughout the frontend
export type SavedQuery = {
  query: DataQuery;
  datasourceName?: string;
  queryText?: string;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
} & Omit<Partial<SavedQueryBase>, 'targets'>;
