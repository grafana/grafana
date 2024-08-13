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
  schedule: string;
  nextSync: string;
}

export interface LdapUserSyncInfo {
  nextSync?: string;
  prevSync?: string;
  status?: string;
}

export interface FailedUser {
  Login: string;
  Error: string;
}

export interface LdapRole {
  orgId: number;
  orgName: string;
  orgRole: string;
  groupDN: string;
}

export interface LdapTeam {
  orgName: string;
  teamName: string;
  groupDN: string;
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

export interface GroupMapping {
  groupDn?: string;
  orgId?: number;
  orgRole?: string;
  grafanaAdmin?: boolean;
}

export interface LdapAttributes {
  email?: string;
  memberOf?: string;
  name?: string;
  surname?: string;
  username?: string;
}

export interface LdapServerConfig {
  attributes: LdapAttributes;
  bindDn: string;
  bindPassword: string;
  clientCert: string;
  clientKey: string;
  groupMappings: GroupMapping[];
  groupSearchBaseDns: string[];
  groupSearchFilter: string;
  groupSearchFilterUserAttribute: string;
  host: string;
  mapLdapGroupsToOrgRoles: boolean;
  minTlsVersion: string;
  port: number;
  rootCaCert: string;
  searchBaseDn: string[];
  searchFilter: string;
  sslSkipVerify: boolean;
  startTls: boolean;
  timeout: number;
  tlsCiphers: string[];
  tlsSkipVerify: boolean;
  useSsl: boolean;
}

export type LdapConnectionInfo = LdapServerInfo[];

export interface LdapState {
  connectionInfo: LdapConnectionInfo;
  user?: LdapUser;
  syncInfo?: SyncInfo;
  connectionError?: LdapError;
  userError?: LdapError;
  ldapError?: LdapError;
  ldapSsoSettings?: LdapServerConfig;
}

export interface LdapConfig {
  server: LdapServerConfig;
}

export interface LdapSettings {
  activeSyncEnabled: boolean;
  allowSignUp: boolean;
  config: LdapConfig;
  enabled: boolean;
  skipOrgRoleSync: boolean;
  syncCron: string;
}

export interface LdapPayload {
  id: string;
  provider: string;
  settings: LdapSettings;
  source: string;
}
