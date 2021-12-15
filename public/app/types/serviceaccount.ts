import { OrgRole, Unit } from '.';
import { SelectableValue } from '@grafana/data';

export interface OrgServiceaccount {
  avatarUrl: string;
  email: string;
  lastSeenAt: string;
  lastSeenAtAge: string;
  login: string;
  name: string;
  orgId: number;
  role: OrgRole;
  serviceaccountId: number;
}

export interface Serviceaccount {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
  email: string;
  name: string;
  orgId?: number;
}

export interface ServiceaccountDTO {
  id: number;
  login: string;
  email: string;
  name: string;
  isGrafanaAdmin: boolean;
  isDisabled: boolean;
  isAdmin?: boolean;
  isExternal?: boolean;
  updatedAt?: string;
  authLabels?: string[];
  theme?: string;
  avatarUrl?: string;
  orgId?: number;
  lastSeenAtAge?: string;
  licensedRole?: string;
  permissions?: string[];
  teams?: Unit[];
  orgs?: Unit[];
}

export interface ServiceaccountsState {
  serviceaccounts: OrgServiceaccount[];
  searchQuery: string;
  searchPage: number;
  hasFetched: boolean;
}

export interface ServiceaccountSession {
  id: number;
  createdAt: string;
  clientIp: string;
  isActive: boolean;
  seenAt: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
}

export interface ServiceaccountOrg {
  name: string;
  orgId: number;
  role: OrgRole;
}

export interface ServiceaccountAdminState {
  serviceaccount?: ServiceaccountDTO;
  sessions: ServiceaccountSession[];
  orgs: ServiceaccountOrg[];
  isLoading: boolean;
  error?: ServiceaccountAdminError;
}

export interface ServiceaccountAdminError {
  title: string;
  body: string;
}

export type ServiceaccountFilter = Record<string, string | boolean | SelectableValue[]>;
export interface ServiceaccountListAdminState {
  serviceaccounts: ServiceaccountDTO[];
  query: string;
  perPage: number;
  page: number;
  totalPages: number;
  showPaging: boolean;
  filters: ServiceaccountFilter[];
  isLoading: boolean;
}
