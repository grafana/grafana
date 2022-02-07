import { OrgRole } from './acl';

export interface ApiKey {
  id?: number;
  name: string;
  role: OrgRole;
  secondsToLive: number | null;
  expiration?: string;
}

export interface NewApiKey {
  name: string;
  role: OrgRole;
  secondsToLive: string;
}

export interface ApiKeysState {
  includeExpired: boolean;
  keys: ApiKey[];
  keysIncludingExpired: ApiKey[];
  searchQuery: string;
  hasFetched: boolean;
}
