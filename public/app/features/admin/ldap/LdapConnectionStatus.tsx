import { useMemo } from 'react';

import { Alert, CellProps, Column, Icon, InteractiveTable, Stack, Text, Tooltip } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { AppNotificationSeverity, LdapConnectionInfo, LdapServerInfo } from 'app/types';

interface Props {
  ldapConnectionInfo: LdapConnectionInfo;
}

interface ServerInfo {
  host: string;
  port: number;
  available: boolean;
}

export const LdapConnectionStatus = ({ ldapConnectionInfo }: Props) => {
  const columns = useMemo<Array<Column<ServerInfo>>>(
    () => [
      {
        id: 'host',
        header: 'Host',
        disableGrow: true,
      },
      {
        id: 'port',
        header: 'Port',
        disableGrow: true,
      },
      {
        id: 'available',
        cell: (serverInfo: CellProps<ServerInfo>) => {
          return serverInfo.cell.value ? (
            <Stack justifyContent="end">
              <Tooltip
                content={t(
                  'admin.ldap-connection-status.columns.content-connection-is-available',
                  'Connection is available'
                )}
              >
                <Icon name="check" />
              </Tooltip>
            </Stack>
          ) : (
            <Stack justifyContent="end">
              <Tooltip
                content={t(
                  'admin.ldap-connection-status.columns.content-connection-is-not-available',
                  'Connection is not available'
                )}
              >
                <Icon name="exclamation-triangle" />
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    []
  );

  const data = useMemo<ServerInfo[]>(() => ldapConnectionInfo, [ldapConnectionInfo]);

  return (
    <section>
      <Stack direction="column" gap={2}>
        <Text color="primary" element="h3">
          <Trans i18nKey="admin.ldap-status.title">LDAP Connection</Trans>
        </Text>
        <InteractiveTable data={data} columns={columns} getRowId={(serverInfo) => serverInfo.host + serverInfo.port} />
        <LdapErrorBox ldapConnectionInfo={ldapConnectionInfo} />
      </Stack>
    </section>
  );
};

interface LdapConnectionErrorProps {
  ldapConnectionInfo: LdapConnectionInfo;
}

export const LdapErrorBox = ({ ldapConnectionInfo }: LdapConnectionErrorProps) => {
  const hasError = ldapConnectionInfo.some((info) => info.error);
  if (!hasError) {
    return null;
  }

  const connectionErrors: LdapServerInfo[] = [];
  ldapConnectionInfo.forEach((info) => {
    if (info.error) {
      connectionErrors.push(info);
    }
  });

  const errorElements = connectionErrors.map((info, index) => (
    <div key={index}>
      <span style={{ fontWeight: 500 }}>
        {`${info.host}:${info.port}`}
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

  return (
    <Alert
      title={t('admin.ldap-error-box.title-connection-error', 'Connection error')}
      severity={AppNotificationSeverity.Error}
    >
      {errorElements}
    </Alert>
  );
};
