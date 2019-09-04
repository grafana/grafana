import React, { FC } from 'react';
import { LdapConnectionInfo } from 'app/types';

interface Props {
  ldapConnectionInfo: LdapConnectionInfo;
  headingStyle: string;
  tableStyle: string;
}

export const LdapConnectionStatus: FC<Props> = ({ ldapConnectionInfo, headingStyle, tableStyle }) => {
  return (
    <>
      <h4 className={headingStyle}>LDAP Connection</h4>
      <table className={`${tableStyle} filter-table form-inline`}>
        <thead>
          <tr>
            <th>Host</th>
            <th colSpan={3}>Port</th>
          </tr>
        </thead>
        <tbody>
          {ldapConnectionInfo.map((serverInfo, index) => (
            <tr key={index}>
              <td>{serverInfo.host}</td>
              <td>{serverInfo.port}</td>
              <td>{serverInfo.error}</td>
              <td>
                {serverInfo.available ? (
                  <i className="fa fa-fw fa-check text-success pull-right" />
                ) : (
                  <i className="fa fa-fw fa-remove text-error pull-right" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
