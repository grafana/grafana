import React, { FC } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertmanagerAlert, Silence } from 'app/plugins/datasource/alertmanager/types';
import SilenceTableRow from './SilenceTableRow';
import { getAlertTableStyles } from '../../styles/table';
import { NoSilencesSplash } from './NoSilencesCTA';

interface Props {
  silences: Silence[];
  alertManagerAlerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

const SilencesTable: FC<Props> = ({ silences, alertManagerAlerts, alertManagerSourceName }) => {
  const styles = useStyles2(getStyles);
  const tableStyles = useStyles2(getAlertTableStyles);

  const findSilencedAlerts = (id: string) => {
    return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
  };
  if (!!silences.length) {
    return (
      <>
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
                  alertManagerSourceName={alertManagerSourceName}
                />
              );
            })}
          </tbody>
        </table>
        <div className={styles.callout}>
          <Icon className={styles.calloutIcon} name="info-circle" />
          <span>
            While you can’t delete a silence, a garbage collector automatically removes all expired-silences every 5
            days.
          </span>
        </div>
      </>
    );
  } else {
    return <NoSilencesSplash />;
  }
};

const getStyles = (theme: GrafanaTheme2) => ({
  colState: css`
    width: 110px;
  `,
  colMatchers: css`
    width: 50%;
  `,
  callout: css`
    background-color: ${theme.colors.bg2};
    border-top: 3px solid ${theme.colors.bgBlue2};
    border-radius: 2px;
    height: 62px;
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: ${theme.spacing.md};

    & > * {
      margin-left: ${theme.spacing.md};
    }
  `,
  calloutIcon: css`
    color: ${theme.colors.bgBlue2};
  `,
});

export default SilencesTable;
