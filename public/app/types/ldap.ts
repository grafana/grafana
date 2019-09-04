interface LdapMapping {
  cfgAttrValue: string;
  ldapValue: string;
}

export interface LdapError {
  title: string;
  body: string;
}

export interface SyncInfo {
  enabled: boolean;
  scheduled: string;
  nextScheduled: string;
  lastSync: string;
}

export interface LdapRole {
  orgId: string;
  orgRole: string;
  ldapAttribute: string;
}

export interface LdapTeam {
  orgId: string;
  teamId: string;
  ldapAttribute: string;
}

export interface LdapUserInfo {
  name: LdapMapping;
  surname: LdapMapping;
  email: LdapMapping;
  login: LdapMapping;
}

export interface LdapPermissions {
  isGrafanaAdmin: boolean;
  isDisabled: boolean;
}

export interface LdapUser {
  info: LdapUserInfo;
  permissions: LdapPermissions;
  roles: LdapRole[];
  teams: LdapTeam[];
}

export interface LdapServerInfo {
  available: boolean;
  host: string;
  port: number;
  error: string;
}

export type LdapConnectionInfo = LdapServerInfo[];

export interface LdapState {
  connectionInfo: LdapConnectionInfo;
  user: LdapUser;
  syncInfo: SyncInfo;
  ldapError: LdapError;
}
