import { WithAccessControlMetadata } from '@grafana/data';

import { OrgRole } from './acl';

export interface ApiKey extends WithAccessControlMetadata {
  id?: number;
  name: string;
  role: OrgRole;
  secondsToLive: number | null;
  expiration?: string;
  secondsUntilExpiration?: number;
  hasExpired?: boolean;
  isRevoked?: boolean;
  created?: string;
  lastUsedAt?: string;
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
  apiKeysMigrated: boolean;
}
