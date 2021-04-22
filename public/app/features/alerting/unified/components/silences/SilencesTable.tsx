import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertmanagerAlert, Silence } from 'app/plugins/datasource/alertmanager/types';
import SilenceTableRow from './SilenceTableRow';
import { getAlertTableStyles } from '../../styles/table';

interface Props {
  silences: Silence[];
  alertManagerAlerts: AlertmanagerAlert[];
}

const SilencesTable: FC<Props> = ({ silences, alertManagerAlerts }) => {
  const styles = useStyles(getStyles);
  const tableStyles = useStyles(getAlertTableStyles);

  const findSilencedAlerts = (id: string) => {
    return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
  };
  return (
    <table className={tableStyles.table}>
      <colgroup>
        <col className={tableStyles.colExpand} />
        <col className={styles.colState} />
        <col className={styles.colMatchers} />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th />
          <th>State</th>
          <th>Matchers</th>
          <th>Alerts</th>
          <th>Schedule</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {silences.map((silence, index) => {
          const silencedAlerts = findSilencedAlerts(silence.id);
          return (
            <SilenceTableRow
              key={silence.id}
              silence={silence}
              className={index % 2 === 0 ? tableStyles.evenRow : undefined}
              silencedAlerts={silencedAlerts}
            />
          );
        })}
      </tbody>
    </table>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  colState: css`
    width: 110px;
  `,
  colMatchers: css`
    width: 50%;
  `,
});

export default SilencesTable;
