interface LdapMapping {
  cfgAttrValue: string;
  ldapValue: string;
}

export interface LdapRole {
  orgId: number;
  orgRole: string;
}

interface LdapTeam {}

export interface LdapUser {
  name: LdapMapping;
  surname: LdapMapping;
  email: LdapMapping;
  login: LdapMapping;
  roles: LdapRole[];
  teams: LdapTeam[];
  isGrafanaAdmin: boolean;
  isDisabled: boolean;
}

export interface LdapState {
  user: LdapUser;
}
