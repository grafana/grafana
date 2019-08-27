import React, { FC } from 'react';

interface Props {
  ldapSyncInfo: {
    enabled: boolean;
    scheduled: string;
    nextScheduled: string;
    lastSync: string;
  };
  headingStyle: string;
  tableStyle: string;
}

export const LdapSyncInfo: FC<Props> = ({ headingStyle, ldapSyncInfo, tableStyle }) => {
  return (
    <>
      <h4 className={headingStyle}>LDAP Synchronisation</h4>
      <table className={`${tableStyle} filter-table form-inline`}>
        <tbody>
          <tr>
            <td>Active synchronisation</td>
            <td>{ldapSyncInfo.enabled ? 'Enabled' : 'Disabled'}</td>
          </tr>
          <tr>
            <td>Scheduled</td>
            <td>{ldapSyncInfo.scheduled}</td>
          </tr>
          <tr>
            <td>Next scheduled synchronisation</td>
            <td>{ldapSyncInfo.nextScheduled}</td>
          </tr>
          <tr>
            <td>Last synchronisation</td>
            <td>{ldapSyncInfo.lastSync}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};
