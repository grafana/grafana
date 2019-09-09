import React, { FC } from 'react';
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserTeams } from './LdapUserTeams';
import { LdapUser } from 'app/types';

interface Props {
  ldapUser: LdapUser;
  className: string;
}

export const LdapUserInfo: FC<Props> = ({ className, ldapUser }) => {
  return (
    <>
      <LdapUserPermissions className={className} key="permissions" permissions={ldapUser.permissions} />
      <LdapUserMappingInfo className={className} key="mappingInfo" info={ldapUser.info} />
      {ldapUser.roles && ldapUser.roles.length > 0 && (
        <LdapUserGroups className={className} key="groups" groups={ldapUser.roles} />
      )}
      {ldapUser.teams && ldapUser.teams.length > 0 && (
        <LdapUserTeams className={className} key="teams" teams={ldapUser.teams} />
      )}
    </>
  );
};
