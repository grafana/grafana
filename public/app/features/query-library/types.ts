import { SavedQueryRef } from './api/SavedQueriesApi';

export interface QueryItem {
  id: number;
  selected?: boolean;
  tags: string[];
  title: string;
  type: string;
  uid: string;
  ds_uid: string[];
  uri: string;
  url: string;
  sortMeta?: number;
  sortMetaName?: string;
  location?: string;
}

type SavedQueryVariable<T = unknown> = {
  type: 'text' | 'datasource' | string; // TODO: enumify
  name: string;
  current: {
    // current.value follows the structure from dashboard variables
    value: T;
  };
};

export type SavedQueryLink = {
  ref: SavedQueryRef;
  variables: SavedQueryVariable[];
};
