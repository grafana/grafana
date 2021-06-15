import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import React, { useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabels } from '../AlertLabels';
import { AmNotificationsAlertsTable } from './AmNotificationsAlertsTable';
import { CollapseToggle } from '../CollapseToggle';

interface Props {
  group: AlertmanagerGroup;
}

export const AmNotificationsGroup = ({ group }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <CollapseToggle isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
        {Object.keys(group.labels).length ? <AlertLabels labels={group.labels} /> : 'No grouping'}
      </div>
      {!isCollapsed && <AmNotificationsAlertsTable alerts={group.alerts} />}
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
    padding: ${theme.spacing(1, 1, 1, 0)};
    background-color: ${theme.colors.background.secondary};
  `,
  groupExpand: css`
    cursor: pointer;
  `,
});
