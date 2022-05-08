export interface FacetField {
  field: string;
  count?: number;
}

export interface SearchQuery {
  query?: string;
  location?: string;
  ds_uid?: string;
  sort?: string;
  tags?: string[];
  kind?: string[];
  uid?: string[];
  id?: number[];
  facet?: FacetField[];
  explain?: boolean;
  accessInfo?: boolean;
  hasPreview?: string; // theme
  limit?: number;
  from?: number;
}

export const emptySearchQuery: SearchQuery = {
  query: '*',
  location: '', // general, etc
  ds_uid: '',
  sort: 'score desc',
  tags: [],
  kind: ['dashboard', 'folder'],
  uid: [],
  id: [],
  explain: true,
  accessInfo: true,
  facet: [{ field: 'kind' }, { field: 'tag' }, { field: 'location' }],
  hasPreview: 'dark',
  from: 0,
  limit: 20,
};
