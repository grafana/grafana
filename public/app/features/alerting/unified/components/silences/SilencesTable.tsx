import React, { FC, useMemo } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Link, Button } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertmanagerAlert, Silence } from 'app/plugins/datasource/alertmanager/types';
import SilenceTableRow from './SilenceTableRow';
import { getAlertTableStyles } from '../../styles/table';
import { NoSilencesSplash } from './NoSilencesCTA';
import { makeAMLink } from '../../utils/misc';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
interface Props {
  silences: Silence[];
  alertManagerAlerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

const SilencesTable: FC<Props> = ({ silences, alertManagerAlerts, alertManagerSourceName }) => {
  const styles = useStyles2(getStyles);
  const tableStyles = useStyles2(getAlertTableStyles);
  const [queryParams] = useQueryParams();

  const filteredSilences = useMemo(() => {
    const silenceIdsString = queryParams?.silenceIds;
    if (typeof silenceIdsString === 'string') {
      return silences.filter((silence) => silenceIdsString.split(',').includes(silence.id));
    }
    return silences;
  }, [queryParams, silences]);

  const findSilencedAlerts = (id: string) => {
    return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
  };

  return (
    <>
      {!!silences.length && (
        <>
          {contextSrv.isEditor && (
            <div className={styles.topButtonContainer}>
              <Link href={makeAMLink('/alerting/silence/new', alertManagerSourceName)}>
                <Button className={styles.addNewSilence} icon="plus">
                  New Silence
                </Button>
              </Link>
            </div>
          )}
          <table className={tableStyles.table}>
            <colgroup>
              <col className={tableStyles.colExpand} />
              <col className={styles.colState} />
              <col className={styles.colMatchers} />
              <col />
              <col />
              {contextSrv.isEditor && <col />}
            </colgroup>
            <thead>
              <tr>
                <th />
                <th>State</th>
                <th>Matching labels</th>
                <th>Alerts</th>
                <th>Schedule</th>
                {contextSrv.isEditor && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSilences.map((silence, index) => {
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
            <span>Expired silences are automatically deleted after 5 days.</span>
          </div>
        </>
      )}
      {!silences.length && <NoSilencesSplash alertManagerSourceName={alertManagerSourceName} />}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  topButtonContainer: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  `,
  addNewSilence: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  colState: css`
    width: 110px;
  `,
  colMatchers: css`
    width: 50%;
  `,
  callout: css`
    background-color: ${theme.colors.background.secondary};
    border-top: 3px solid ${theme.colors.info.border};
    border-radius: 2px;
    height: 62px;
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: ${theme.spacing(2)};

    & > * {
      margin-left: ${theme.spacing(1)};
    }
  `,
  calloutIcon: css`
    color: ${theme.colors.info.text};
  `,
});

export default SilencesTable;
