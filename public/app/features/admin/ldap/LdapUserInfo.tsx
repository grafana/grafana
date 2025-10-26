import { Trans } from '@grafana/i18n';
import { Box, Stack, Text } from '@grafana/ui';
import { LdapUser } from 'app/types/ldap';

import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserTeams } from './LdapUserTeams';

interface Props {
  ldapUser: LdapUser;
}

export const LdapUserInfo = ({ ldapUser }: Props) => {
  return (
    <Stack direction="column" gap={4}>
      <LdapUserMappingInfo info={ldapUser.info} />
      <LdapUserPermissions permissions={ldapUser.permissions} />
      {ldapUser.roles && ldapUser.roles.length > 0 && <LdapUserGroups groups={ldapUser.roles} />}

      {ldapUser.teams && ldapUser.teams.length > 0 ? (
        <LdapUserTeams teams={ldapUser.teams} />
      ) : (
        <Box>
          <Text>
            <Trans i18nKey="admin.ldap-user-info.no-team">No teams found via LDAP</Trans>
          </Text>
        </Box>
      )}
    </Stack>
  );
};
