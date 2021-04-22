import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { useStyles } from '@grafana/ui';
import { SilencedAlertsTableRow } from './SilencedAlertsTableRow';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  silencedAlerts: AlertmanagerAlert[];
}

const SilencedAlertsTable: FC<Props> = ({ silencedAlerts }) => {
  const tableStyles = useStyles(getAlertTableStyles);
  const styles = useStyles(getStyles);

  if (!!silencedAlerts.length) {
    return (
      <table className={tableStyles.table}>
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col className={styles.colState} />
          <col className={styles.colName} />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <th></th>
          <th>State</th>
          <th>Alert name</th>
          <th>State change</th>
          <th>Status</th>
          <th>Actions</th>
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
  colState: css`
    width: 110px;
  `,
  colName: css`
    width: 40%;
  `,
});

export default SilencedAlertsTable;
