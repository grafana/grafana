import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';

import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';

import { AlertGroupAlertsTable } from './AlertGroupAlertsTable';
import { AlertGroupHeader } from './AlertGroupHeader';

interface Props {
  group: AlertmanagerGroup;
  alertManagerSourceName: string;
}

export const AlertGroup = ({ alertManagerSourceName, group }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.group} data-testid="alert-group">
          <CollapseToggle
            size="sm"
            isCollapsed={isCollapsed}
            onToggle={() => setIsCollapsed(!isCollapsed)}
            data-testid="alert-group-collapse-toggle"
          />
          {Object.keys(group.labels).length ? <AlertLabels labels={group.labels} /> : <span>No grouping</span>}
        </div>
        <AlertGroupHeader group={group} />
      </div>
      {!isCollapsed && <AlertGroupAlertsTable alertManagerSourceName={alertManagerSourceName} alerts={group.alerts} />}
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
