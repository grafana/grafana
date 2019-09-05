import React, { FC } from 'react';
import { AlertBox } from '../../core/components/AlertBox/AlertBox';
import { AppNotificationSeverity, LdapConnectionInfo } from 'app/types';

interface Props {
  ldapConnectionInfo: LdapConnectionInfo;
  headingStyle: string;
  tableStyle: string;
}

export const LdapConnectionStatus: FC<Props> = ({ ldapConnectionInfo, headingStyle, tableStyle }) => {
  const hasError = ldapConnectionInfo.some(info => info.error);
  const connectionError = ldapConnectionInfo.map((info, index) => {
    return info.error ? (
      <div key={index} style={{ marginTop: '0.4rem' }}>
        <span>
          {info.host}:{info.port}
          <br />
        </span>
        <span>{info.error}</span>
      </div>
    ) : null;
  });
  return (
    <>
      <h4 className={headingStyle}>LDAP Connection</h4>
      <div className={tableStyle}>
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Host</th>
              <th colSpan={3}>Port</th>
            </tr>
          </thead>
          <tbody>
            {ldapConnectionInfo &&
              ldapConnectionInfo.map((serverInfo, index) => (
                <tr key={index}>
                  <td>{serverInfo.host}</td>
                  <td>{serverInfo.port}</td>
                  <td>{serverInfo.error}</td>
                  <td>
                    {serverInfo.available ? (
                      <i className="fa fa-fw fa-check pull-right" />
                    ) : (
                      <i className="fa fa-fw fa-exclamation-triangle pull-right" />
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {hasError && (
          <AlertBox title="Connection error" severity={AppNotificationSeverity.Error} body={connectionError} />
        )}
      </div>
    </>
  );
};
