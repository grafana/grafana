import React from 'react';

import { Box, Stack, Text } from '@grafana/ui';
import { LdapUser } from 'app/types';

import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserTeams } from './LdapUserTeams';

interface Props {
  ldapUser: LdapUser;
  showAttributeMapping?: boolean;
}

export const LdapUserInfo = ({ ldapUser, showAttributeMapping }: Props) => {
  return (
    <Stack direction="column" gap={4}>
      <LdapUserMappingInfo info={ldapUser.info} showAttributeMapping={showAttributeMapping} />
      <LdapUserPermissions permissions={ldapUser.permissions} />
      {ldapUser.roles && ldapUser.roles.length > 0 && (
        <LdapUserGroups groups={ldapUser.roles} showAttributeMapping={showAttributeMapping} />
      )}

      {ldapUser.teams && ldapUser.teams.length > 0 ? (
        <LdapUserTeams teams={ldapUser.teams} showAttributeMapping={showAttributeMapping} />
      ) : (
        <Box>
          <Text>No teams found via LDAP</Text>
        </Box>
      )}
    </Stack>
  );
};
