import React, { FC, useMemo } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Link, Button } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertmanagerAlert, Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';
import SilenceTableRow from './SilenceTableRow';
import { getAlertTableStyles } from '../../styles/table';
import { NoSilencesSplash } from './NoSilencesCTA';
import { getFiltersFromUrlParams, makeAMLink } from '../../utils/misc';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { SilencesFilter } from './SilencesFilter';
import { parseMatchers } from '../../utils/alertmanager';
interface Props {
  silences: Silence[];
  alertManagerAlerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

const SilencesTable: FC<Props> = ({ silences, alertManagerAlerts, alertManagerSourceName }) => {
  const styles = useStyles2(getStyles);
  const tableStyles = useStyles2(getAlertTableStyles);
  const [queryParams] = useQueryParams();
  const filteredSilences = useFilteredSilences(silences);

  const { silenceState } = getFiltersFromUrlParams(queryParams);

  const showExpiredSilencesBanner =
    !!filteredSilences.length && (silenceState === undefined || silenceState === SilenceState.Expired);

  const findSilencedAlerts = (id: string) => {
    return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
  };

  return (
    <div data-testid="silences-table">
      {!!silences.length && (
        <>
          <SilencesFilter />
          {contextSrv.isEditor && (
            <div className={styles.topButtonContainer}>
              <Link href={makeAMLink('/alerting/silence/new', alertManagerSourceName)}>
                <Button className={styles.addNewSilence} icon="plus">
                  New Silence
                </Button>
              </Link>
            </div>
          )}
          {!!filteredSilences.length ? (
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
          ) : (
            <div className={styles.callout}>
              <Icon className={styles.calloutIcon} name="info-circle" />
              <span>No silences match your filters</span>
            </div>
          )}

          {showExpiredSilencesBanner && (
            <div className={styles.callout}>
              <Icon className={styles.calloutIcon} name="info-circle" />
              <span>Expired silences are automatically deleted after 5 days.</span>
            </div>
          )}
        </>
      )}
      {!silences.length && <NoSilencesSplash alertManagerSourceName={alertManagerSourceName} />}
    </div>
  );
};

const useFilteredSilences = (silences: Silence[]) => {
  const [queryParams] = useQueryParams();
  return useMemo(() => {
    const { queryString, silenceState } = getFiltersFromUrlParams(queryParams);
    const silenceIdsString = queryParams?.silenceIds;
    return silences.filter((silence) => {
      if (typeof silenceIdsString === 'string') {
        const idsIncluded = silenceIdsString.split(',').includes(silence.id);
        if (!idsIncluded) {
          return false;
        }
      }
      if (queryString) {
        const matchers = parseMatchers(queryString);
        const matchersMatch = matchers.every((matcher) =>
          silence.matchers?.some(
            ({ name, value, isEqual, isRegex }) =>
              matcher.name === name &&
              matcher.value === value &&
              matcher.isEqual === isEqual &&
              matcher.isRegex === isRegex
          )
        );
        if (!matchersMatch) {
          return false;
        }
      }
      if (silenceState) {
        const stateMatches = silence.status.state === silenceState;
        if (!stateMatches) {
          return false;
        }
      }
      return true;
    });
  }, [queryParams, silences]);
};

const getStyles = (theme: GrafanaTheme2) => ({
  topButtonContainer: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  `,
  addNewSilence: css`
    margin: ${theme.spacing(2, 0)};
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
