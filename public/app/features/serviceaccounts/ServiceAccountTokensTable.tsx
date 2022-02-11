import React, { FC } from 'react';
import { DeleteButton, Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { dateTimeFormat, GrafanaTheme2, TimeZone } from '@grafana/data';

import { ApiKey } from '../../types';
import { css } from '@emotion/css';

interface Props {
  tokens: ApiKey[];
  timeZone: TimeZone;
  onDelete: (token: ApiKey) => void;
}

export const ServiceAccountTokensTable: FC<Props> = ({ tokens, timeZone, onDelete }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <>
      <table className="filter-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Expires</th>
            <th style={{ width: '34px' }} />
          </tr>
        </thead>
        <tbody>
          {tokens.map((key) => {
            const isExpired = !!(key.expiration && Date.now() > new Date(key.expiration).getTime());
            return (
              <tr key={key.id} className={styles.tableRow(isExpired)}>
                <td>{key.name}</td>
                <td>
                  {formatDate(timeZone, key.expiration)}
                  {isExpired && (
                    <span className={styles.tooltipContainer}>
                      <Tooltip content="This API key has expired.">
                        <Icon name="exclamation-triangle" />
                      </Tooltip>
                    </span>
                  )}
                </td>
                <td>
                  <DeleteButton aria-label="Delete API key" size="sm" onConfirm={() => onDelete(key)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

function formatDate(timeZone: TimeZone, expiration?: string): string {
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
