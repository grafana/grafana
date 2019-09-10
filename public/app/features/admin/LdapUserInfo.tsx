import React, { FC } from 'react';
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserTeams } from './LdapUserTeams';
import { LdapUser } from 'app/types';

interface Props {
  ldapUser: LdapUser;
  className: string;
  showAttributeMapping?: boolean;
}

export const LdapUserInfo: FC<Props> = ({ className, ldapUser, showAttributeMapping }) => {
  return (
    <>
      <LdapUserPermissions className={className} permissions={ldapUser.permissions} />
      <LdapUserMappingInfo className={className} info={ldapUser.info} showAttributeMapping={showAttributeMapping} />
      {ldapUser.roles && ldapUser.roles.length > 0 && (
        <LdapUserGroups className={className} groups={ldapUser.roles} showAttributeMapping={showAttributeMapping} />
      )}
      {ldapUser.teams && ldapUser.teams.length > 0 && <LdapUserTeams className={className} teams={ldapUser.teams} />}
    </>
  );
};
