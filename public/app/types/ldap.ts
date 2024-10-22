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
  group_dn?: string;
  org_id?: number;
  org_role?: string;
  grafana_admin?: boolean;
}

export interface LdapAttributes {
  email?: string;
  member_of?: string;
  name?: string;
  surname?: string;
  username?: string;
}

export interface LdapServerConfig {
  attributes: LdapAttributes;
  bind_dn: string;
  bind_password?: string;
  client_cert: string;
  client_cert_value: string;
  client_key: string;
  client_key_value: string;
  group_mappings: GroupMapping[];
  group_search_base_dns: string[];
  group_search_filter: string;
  group_search_filter_user_attribute: string;
  host: string;
  min_tls_version?: string;
  port: number;
  root_ca_cert: string;
  root_ca_cert_value: string[];
  search_base_dns: string[];
  search_filter: string;
  skip_org_role_sync: boolean;
  ssl_skip_verify: boolean;
  start_tls: boolean;
  timeout: number;
  tls_ciphers: string[];
  tls_skip_verify: boolean;
  use_ssl: boolean;
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
  servers: LdapServerConfig[];
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

export interface MapKeyCertConfigured {
  clientKeyCertValue: boolean;
  clientKeyCertPath: boolean;
}
