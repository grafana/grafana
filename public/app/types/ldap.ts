interface LdapMapping {
  cfgAttrValue: string;
  ldapValue: string;
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

export interface LdapState {
  user: LdapUser;
}
