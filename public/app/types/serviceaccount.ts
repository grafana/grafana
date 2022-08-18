import { WithAccessControlMetadata } from '@grafana/data';

import { ApiKey, OrgRole, Role } from '.';

export interface OrgServiceAccount extends WithAccessControlMetadata {
  serviceAccountId: number;
  avatarUrl: string;
  email: string;
  login: string;
  name: string;
  displayName: string;
  orgId: number;
  role: OrgRole;
  tokens: number[];
}

export interface ServiceAccount {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
  email: string;
  name: string;
  displayName: string;
  orgId?: number;
}

export interface ServiceAccountDTO extends WithAccessControlMetadata {
  id: number;
  orgId: number;
  tokens: number;
  name: string;
  login: string;
  avatarUrl?: string;
  createdAt: string;
  isDisabled: boolean;
  teams: string[];
  role: OrgRole;
}

export interface ServiceAccountCreateApiResponse {
  avatarUrl?: string;
  id: number;
  isDisabled: boolean;
  login: string;
  name: string;
  orgId: number;
  role: OrgRole;
  tokens: number;
}

export interface ServiceAccountProfileState {
  serviceAccount: ServiceAccountDTO;
  isLoading: boolean;
  tokens: ApiKey[];
}

export enum ServiceAccountStateFilter {
  All = 'All',
  WithExpiredTokens = 'WithExpiredTokens',
  Disabled = 'Disabled',
}

export interface ServiceAccountsState {
  serviceAccounts: ServiceAccountDTO[];
  isLoading: boolean;
  roleOptions: Role[];
  apiKeysMigrated: boolean;
  showApiKeysMigrationInfo: boolean;

  // search / filtering
  query: string;
  perPage: number;
  page: number;
  totalPages: number;
  showPaging: boolean;
  serviceAccountStateFilter: ServiceAccountStateFilter;
}

export interface ServiceAccountsUpgradeStatus {
  upgraded: boolean;
}
