import React from 'react';

import { dateTimeFormat } from '@grafana/data';
import { InteractiveTable, Text } from '@grafana/ui';
import { SyncInfo } from 'app/types';

interface Props {
  ldapSyncInfo: SyncInfo;
}

const format = 'dddd YYYY-MM-DD HH:mm zz';

export const LdapSyncInfo = ({ ldapSyncInfo }: Props) => {
  const nextSyncTime = dateTimeFormat(ldapSyncInfo.nextSync, { format });

  const columns = [{ id: 'syncAttribute' }, { id: 'syncValue' }];
  const data = [
    {
      syncAttribute: 'Active synchronization',
      syncValue: ldapSyncInfo.enabled ? 'Enabled' : 'Disabled',
    },
    {
      syncAttribute: 'Scheduled',
      syncValue: ldapSyncInfo.schedule,
    },
    {
      syncAttribute: 'Next synchronization',
      syncValue: nextSyncTime,
    },
  ];

  return (
    <section>
      <Text element="h3">LDAP Synchronization</Text>
      <InteractiveTable data={data} columns={columns} getRowId={(sync) => sync.syncAttribute} />
    </section>
  );
};
