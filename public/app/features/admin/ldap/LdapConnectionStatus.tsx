import React, { FC } from 'react';
import { Alert } from '@grafana/ui';
import { AppNotificationSeverity, LdapConnectionInfo, LdapServerInfo } from 'app/types';

interface Props {
  ldapConnectionInfo: LdapConnectionInfo;
}

export const LdapConnectionStatus: FC<Props> = ({ ldapConnectionInfo }) => {
  return (
    <>
      <h3 className="page-heading">LDAP Connection</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Host</th>
                <th colSpan={2}>Port</th>
              </tr>
            </thead>
            <tbody>
              {ldapConnectionInfo &&
                ldapConnectionInfo.map((serverInfo, index) => (
                  <tr key={index}>
                    <td>{serverInfo.host}</td>
                    <td>{serverInfo.port}</td>
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
        </div>
        <div className="gf-form-group">
          <LdapErrorBox ldapConnectionInfo={ldapConnectionInfo} />
        </div>
      </div>
    </>
  );
};

interface LdapConnectionErrorProps {
  ldapConnectionInfo: LdapConnectionInfo;
}

export const LdapErrorBox: FC<LdapConnectionErrorProps> = ({ ldapConnectionInfo }) => {
  const hasError = ldapConnectionInfo.some(info => info.error);
  if (!hasError) {
    return null;
  }

  const connectionErrors: LdapServerInfo[] = [];
  ldapConnectionInfo.forEach(info => {
    if (info.error) {
      connectionErrors.push(info);
    }
  });

  const errorElements = connectionErrors.map((info, index) => (
    <div key={index}>
      <span style={{ fontWeight: 500 }}>
        {info.host}:{info.port}
        <br />
      </span>
      <span>{info.error}</span>
      {index !== connectionErrors.length - 1 && (
        <>
          <br />
          <br />
        </>
      )}
    </div>
  ));

  return <Alert title="Connection error" severity={AppNotificationSeverity.Error} children={errorElements} />;
};
