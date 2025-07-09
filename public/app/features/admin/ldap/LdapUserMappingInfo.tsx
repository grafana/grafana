import { useMemo } from 'react';

import { InteractiveTable } from '@grafana/ui';
import { LdapUserInfo } from 'app/types/ldap';

interface Props {
  info: LdapUserInfo;
}

export const LdapUserMappingInfo = ({ info }: Props) => {
  const columns = useMemo(
    () => [
      {
        id: 'userInfo',
        header: 'User Information',
        disableGrow: true,
      },
      {
        id: 'ldapValue',
      },
      {
        id: 'cfgAttrValue',
        header: 'LDAP attribute',
      },
    ],
    []
  );

  const rows = useMemo(
    () => [
      {
        userInfo: 'First name',
        ldapValue: info.name.ldapValue,
        cfgAttrValue: info.name.cfgAttrValue,
      },
      {
        userInfo: 'Surname',
        ldapValue: info.surname.ldapValue,
        cfgAttrValue: info.surname.cfgAttrValue,
      },
      {
        userInfo: 'Username',
        ldapValue: info.login.ldapValue,
        cfgAttrValue: info.login.cfgAttrValue,
      },
      {
        userInfo: 'Email',
        ldapValue: info.email.ldapValue,
        cfgAttrValue: info.email.cfgAttrValue,
      },
    ],
    [info]
  );

  return <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.userInfo} />;
};
