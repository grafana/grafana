import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { InteractiveTable, useStyles2 } from '@grafana/ui';
import { LdapUserInfo } from 'app/types';

interface Props {
  info: LdapUserInfo;
  showAttributeMapping?: boolean;
}

export const LdapUserMappingInfo = ({ info, showAttributeMapping }: Props) => {
  const styles = useStyles2(getStyles);
  const columns = [
    {
      id: 'userInfo',
      header: 'User Information',
    },
    {
      id: 'ldapValue',
    },
  ];
  if (showAttributeMapping) {
    columns.push({
      id: 'cfgAttrValue',
      header: 'LDAP attribute',
    });
  }

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

  return <InteractiveTable className={styles} columns={columns} data={rows} getRowId={(row) => row.userInfo} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return css({
    '& tr > td:first-child': {
      width: theme.spacing(6),
    },
  });
};
