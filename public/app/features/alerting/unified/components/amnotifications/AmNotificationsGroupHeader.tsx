import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  group: AlertmanagerGroup;
}

export const AmNotificationsGroupHeader = ({ group }: Props) => {
  const styles = useStyles2(getStyles);
  const total = group.alerts.length;
  const countByStatus = group.alerts.reduce((statusObj, alert) => {
    if (statusObj[alert.status.state]) {
      statusObj[alert.status.state] += 1;
    } else {
      statusObj[alert.status.state] = 1;
    }
    return statusObj;
  }, {} as Record<AlertState, number>);

  return (
    <div className={styles.summary}>
      {`${total} alerts: `}
      {Object.entries(countByStatus).map(([state, count], index) => {
        return (
          <span key={`${JSON.stringify(group.labels)}-notifications-${index}`} className={styles[state as AlertState]}>
            {index > 0 && ', '}
            {`${count} ${state}`}
          </span>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  summary: css``,
  [AlertState.Active]: css`
    color: ${theme.colors.error.main};
  `,
  [AlertState.Suppressed]: css`
    color: ${theme.colors.primary.main};
  `,
  [AlertState.Unprocessed]: css`
    color: ${theme.colors.secondary.main};
  `,
});
