import { OrgRole, Unit } from '.';
import { SelectableValue } from '@grafana/data';

export interface OrgServiceAccount {
  avatarUrl: string;
  email: string;
  lastSeenAt: string;
  lastSeenAtAge: string;
  login: string;
  name: string;
  orgId: number;
  role: OrgRole;
  serviceAccountId: number;
}

export interface ServiceAccount {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
  email: string;
  name: string;
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
  lastSeenAtAge?: string;
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

export interface ServiceAccountSession {
  id: number;
  createdAt: string;
  clientIp: string;
  isActive: boolean;
  seenAt: string;
}

export interface ServiceAccountOrg {
  name: string;
  orgId: number;
  role: OrgRole;
}

export type ServiceAccountFilter = Record<string, string | boolean | SelectableValue[]>;
export interface ServiceaccountListAdminState {
  serviceaccounts: ServiceAccountDTO[];
  query: string;
  perPage: number;
  page: number;
  totalPages: number;
  showPaging: boolean;
  filters: ServiceAccountFilter[];
  isLoading: boolean;
}
