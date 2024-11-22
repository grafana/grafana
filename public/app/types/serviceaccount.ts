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
  uid: string;
  orgId: number;
  tokens: number;
  name: string;
  login: string;
  avatarUrl?: string;
  createdAt: string;
  isDisabled: boolean;
  isExternal?: boolean;
  requiredBy?: string;
  teams: string[];
  role: OrgRole;
  roles?: Role[];
}

export interface ServiceAccountCreateApiResponse {
  avatarUrl?: string;
  id: number;
  uid: string;
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
  rolesLoading?: boolean;
  tokens: ApiKey[];
}

export enum ServiceAccountStateFilter {
  All = 'All',
  WithExpiredTokens = 'WithExpiredTokens',
  External = 'External',
  Disabled = 'Disabled',
}

export interface ServiceAccountsState {
  serviceAccounts: ServiceAccountDTO[];
  isLoading: boolean;
  roleOptions: Role[];

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
