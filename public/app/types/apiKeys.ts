import { type OrgRole, type WithAccessControlMetadata } from '@grafana/data';

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
