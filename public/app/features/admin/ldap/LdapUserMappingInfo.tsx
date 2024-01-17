import React from 'react';

import { InteractiveTable } from '@grafana/ui';
import { LdapUserInfo } from 'app/types';

interface Props {
  info: LdapUserInfo;
  showAttributeMapping?: boolean;
}

export const LdapUserMappingInfo = ({ info, showAttributeMapping }: Props) => {
  const columns = [
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
      visible: () => !!showAttributeMapping,
    },
  ];

  const rows = [
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
  ];

  return <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.userInfo} />;
};
