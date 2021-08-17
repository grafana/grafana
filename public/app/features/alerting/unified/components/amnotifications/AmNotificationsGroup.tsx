import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';
import React, { useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabels } from '../AlertLabels';
import { AmNotificationsAlertsTable } from './AmNotificationsAlertsTable';
import { CollapseToggle } from '../CollapseToggle';
import { AmNotificationsGroupHeader } from './AmNotificationsGroupHeader';

interface Props {
  group: AlertmanagerGroup;
  alertManagerSourceName: string;
}

export const AmNotificationsGroup = ({ alertManagerSourceName, group }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.group} data-testid="notifications-group">
          <CollapseToggle
            isCollapsed={isCollapsed}
            onToggle={() => setIsCollapsed(!isCollapsed)}
            data-testid="notifications-group-collapse-toggle"
          />
          {Object.keys(group.labels).length ? (
            <AlertLabels className={styles.headerLabels} labels={group.labels} />
          ) : (
            <span>No grouping</span>
          )}
        </div>
        <AmNotificationsGroupHeader group={group} />
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
  headerLabels: css`
    padding-bottom: 0 !important;
    margin-bottom: -${theme.spacing(0.5)};
  `,
  header: css`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
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
