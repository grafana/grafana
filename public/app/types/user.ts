import { TimeZone } from '@grafana/data';
import { OrgRole } from '.';

export interface OrgUser {
  avatarUrl: string;
  email: string;
  lastSeenAt: string;
  lastSeenAtAge: string;
  login: string;
  name: string;
  orgId: number;
  role: OrgRole;
  userId: number;
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

export interface UserDTO {
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
  invitees: Invitee[];
  searchQuery: string;
  canInvite: boolean;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  hasFetched: boolean;
}

export interface UserState {
  orgId: number;
  timeZone: TimeZone;
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
  user: UserDTO | null;
  sessions: UserSession[];
  orgs: UserOrg[];
  isLoading: boolean;
  error?: UserAdminError | null;
}

export interface UserAdminError {
  title: string;
  body: string;
}

export interface UserListAdminState {
  users: UserDTO[];
  query: string;
  perPage: number;
  page: number;
  totalPages: number;
  showPaging: boolean;
}
