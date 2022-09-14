import { css } from '@emotion/css';
import React, { FC } from 'react';

import { dateTimeFormat, GrafanaTheme2, TimeZone } from '@grafana/data';
import { Button, DeleteButton, HorizontalGroup, Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { ApiKey } from '../../types';

interface Props {
  apiKeys: ApiKey[];
  timeZone: TimeZone;
  onDelete: (apiKey: ApiKey) => void;
  onMigrate: (apiKey: ApiKey) => void;
}

export const ApiKeysTable: FC<Props> = ({ apiKeys, timeZone, onDelete, onMigrate }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <table className="filter-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Expires</th>
          <th style={{ width: '34px' }} />
        </tr>
      </thead>
      {apiKeys.length > 0 ? (
        <tbody>
          {apiKeys.map((key) => {
            const isExpired = Boolean(key.expiration && Date.now() > new Date(key.expiration).getTime());
            return (
              <tr key={key.id} className={styles.tableRow(isExpired)}>
                <td>{key.name}</td>
                <td>{key.role}</td>
                <td>
                  {formatDate(key.expiration, timeZone)}
                  {isExpired && (
                    <span className={styles.tooltipContainer}>
                      <Tooltip content="This API key has expired.">
                        <Icon name="exclamation-triangle" />
                      </Tooltip>
                    </span>
                  )}
                </td>
                <td>
                  <HorizontalGroup justify="flex-end">
                    <Button size="sm" onClick={() => onMigrate(key)}>
                      Migrate to service account
                    </Button>
                    <DeleteButton
                      aria-label="Delete API key"
                      size="sm"
                      onConfirm={() => onDelete(key)}
                      disabled={!contextSrv.hasPermissionInMetadata(AccessControlAction.ActionAPIKeysDelete, key)}
                    />
                  </HorizontalGroup>
                </td>
              </tr>
            );
          })}
        </tbody>
      ) : null}
    </table>
  );
};

function formatDate(expiration: string | undefined, timeZone: TimeZone): string {
  if (!expiration) {
    return 'No expiration date';
  }
  return dateTimeFormat(expiration, { timeZone });
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableRow: (isExpired: boolean) => css`
    color: ${isExpired ? theme.colors.text.secondary : theme.colors.text.primary};
  `,
  tooltipContainer: css`
    margin-left: ${theme.spacing(1)};
  `,
});
