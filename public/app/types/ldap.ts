interface LdapMapping {
  cfgAttrValue: string;
  ldapValue: string;
}

export interface LdapRole {
  orgId: number;
  orgRole: string;
}

interface LdapTeam {}
export interface LdapUserInfo {
  name: LdapMapping;
  surname: LdapMapping;
  email: LdapMapping;
  login: LdapMapping;
}

interface LdapPermissions {
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
