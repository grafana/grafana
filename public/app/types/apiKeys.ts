import { OrgRole } from './acl';

export interface ApiKey {
  id: number;
  name: string;
  role: OrgRole;
  secondsToLive: number;
  expiration: string;
}

export interface NewApiKey {
  name: string;
  role: OrgRole;
  secondsToLive: number;
}

export interface ApiKeysState {
  keys: ApiKey[];
  searchQuery: string;
  hasFetched: boolean;
}
