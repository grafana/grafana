import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';

import { AmNotificationsAlertsTableRow } from './AmNotificationsAlertsTableRow';
import { getAlertTableStyles } from '../../styles/table';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  alerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

export const AmNotificationsAlertsTable = ({ alerts, alertManagerSourceName }: Props) => {
  const tableStyles = useStyles2(getAlertTableStyles);
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.tableWrapper}>
      <table className={tableStyles.table} data-testid="notifications-table">
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col className={styles.stateCol} />
          <col />
          <col className={styles.buffer} />
        </colgroup>
        <thead>
          <th></th>
          <th>State</th>
          <th>Labels</th>
          <th />
        </thead>
        <tbody>
          {alerts.map((alert, index) => {
            return (
              <AmNotificationsAlertsTableRow
                className={index % 2 === 0 ? tableStyles.evenRow : undefined}
                alert={alert}
                alertManagerSourceName={alertManagerSourceName}
                key={alert.fingerprint}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css`
    margin: ${theme.spacing(2, 0, 0, 4.5)};
  `,
  stateCol: css`
    width: 228px;
  `,
  labelsCol: css`
    width: 60%;
  `,
  buffer: css`
    width: ${theme.spacing(4.5)};
  `,
});
