import { OrgRole } from './acl';

export interface ApiKey {
  id: number;
  name: string;
  role: OrgRole;
}

export interface ApiKeysState {
  keys: ApiKey[];
}
