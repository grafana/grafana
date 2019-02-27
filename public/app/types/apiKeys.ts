import { OrgRole } from './acl';

export interface ApiKey {
  id: number;
  name: string;
  role: OrgRole;
}

export interface NewApiKey {
  name: string;
  role: OrgRole;
}

export interface ApiKeysState {
  keys: ApiKey[];
  searchQuery: string;
  hasFetched: boolean;
}
