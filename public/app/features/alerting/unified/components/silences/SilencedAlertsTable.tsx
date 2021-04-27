import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { useStyles } from '@grafana/ui';
import { SilencedAlertsTableRow } from './SilencedAlertsTableRow';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';

interface Props {
  silencedAlerts: AlertmanagerAlert[];
}

const SilencedAlertsTable: FC<Props> = ({ silencedAlerts }) => {
  const tableStyles = useStyles(getAlertTableStyles);
  const styles = useStyles(getStyles);

  if (!!silencedAlerts.length) {
    return (
      <table className={cx(tableStyles.table, styles.tableMargin)}>
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col className={styles.colState} />
          <col />
          <col className={styles.colName} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th>State</th>
            <th></th>
            <th>Alert name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {silencedAlerts.map((alert, index) => {
            return (
              <SilencedAlertsTableRow
                key={alert.fingerprint}
                alert={alert}
                className={index % 2 === 0 ? tableStyles.evenRow : ''}
              />
            );
          })}
        </tbody>
      </table>
    );
  } else {
    return null;
  }
};

const getStyles = (theme: GrafanaTheme) => ({
  tableMargin: css`
    margin-bottom: ${theme.spacing.sm};
  `,
  colState: css`
    width: 110px;
  `,
  colName: css`
    width: 65%;
  `,
});

export default SilencedAlertsTable;
