import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';
import React, { useState, useMemo } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabels } from '../AlertLabels';
import { AmNotificationsAlertsTable } from './AmNotificationsAlertsTable';
import { CollapseToggle } from '../CollapseToggle';

interface Props {
  group: AlertmanagerGroup;
  alertManagerSourceName: string;
}

export const AmNotificationsGroup = ({ alertManagerSourceName, group }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

  const headerSummary = useMemo(() => {
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
            <span key={`${group.id}-${index}`} className={styles[state as AlertState]}>
              {index > 0 && ', '}
              {`${count} ${state}`}
            </span>
          );
        })}
      </div>
    );
  }, [group, styles]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.group}>
          <CollapseToggle isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
          {Object.keys(group.labels).length ? <AlertLabels labels={group.labels} /> : <span>No grouping</span>}
        </div>
        {headerSummary}
      </div>
      {!isCollapsed && (
        <AmNotificationsAlertsTable alertManagerSourceName={alertManagerSourceName} alerts={group.alerts} />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    & + & {
      margin-top: ${theme.spacing(2)};
    }
  `,
  header: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing(1, 1, 1, 0)};
    background-color: ${theme.colors.background.secondary};
    width: 100%;
  `,
  group: css`
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
  summary: css``,
  spanElement: css`
    margin-left: ${theme.spacing(0.5)};
  `,
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
