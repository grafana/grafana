import { SelectableValue, WithAccessControlMetadata } from '@grafana/data';

import { OrgRole } from '.';
export interface OrgUser extends WithAccessControlMetadata {
  avatarUrl: string;
  email: string;
  lastSeenAt: string;
  lastSeenAtAge: string;
  login: string;
  name: string;
  orgId: number;
  role: OrgRole;
  userId: number;
  isDisabled: boolean;
  authLabels?: string[];
  isExternallySynced?: boolean;
}

export interface User {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
  email: string;
  name: string;
  orgId?: number;
}

export type Unit = { name: string; url: string };

export interface UserDTO extends WithAccessControlMetadata {
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
  isExternallySynced?: boolean;
}

export interface Invitee {
  code: string;
  createdOn: string;
  email: string;
  emailSent: boolean;
  emailSentOn: string;
  id: number;
  invitedByEmail: string;
  invitedByLogin: string;
  invitedByName: string;
  name: string;
  orgId: number;
  role: string;
  status: string;
  url: string;
}

export interface UsersState {
  users: OrgUser[];
  searchQuery: string;
  canInvite: boolean;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  isLoading: boolean;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface UserSession {
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

export interface UserOrg {
  name: string;
  orgId: number;
  role: OrgRole;
}

export interface UserAdminState {
  user?: UserDTO;
  sessions: UserSession[];
  orgs: UserOrg[];
  isLoading: boolean;
  error?: UserAdminError;
}

export interface UserAdminError {
  title: string;
  body: string;
}

export type UserFilter = Record<string, string | boolean | SelectableValue[]>;
export interface UserListAdminState {
  users: UserDTO[];
  query: string;
  perPage: number;
  page: number;
  totalPages: number;
  showPaging: boolean;
  filters: UserFilter[];
  isLoading: boolean;
}
