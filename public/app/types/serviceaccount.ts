import { OrgRole, Unit } from '.';

export interface OrgServiceAccount {
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

export interface ServiceAccountDTO {
  id: number;
  login: string;
  email: string;
  name: string;
  isGrafanaAdmin: boolean;
  isDisabled: boolean;
  isAdmin?: boolean;
  updatedAt?: string;
  authLabels?: string[];
  avatarUrl?: string;
  orgId?: number;
  licensedRole?: string;
  permissions?: string[];
  teams?: Unit[];
  orgs?: Unit[];
}

export interface ServiceAccountsState {
  serviceAccounts: OrgServiceAccount[];
  searchQuery: string;
  searchPage: number;
  isLoading: boolean;
}
