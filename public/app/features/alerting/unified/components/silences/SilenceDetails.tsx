import { css } from '@emotion/css';
import React from 'react';

import { dateMath, GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import SilencedAlertsTable from './SilencedAlertsTable';
import { SilenceTableItem } from './SilencesTable';

interface Props {
  silence: SilenceTableItem;
}

export const SilenceDetails = ({ silence }: Props) => {
  const { startsAt, endsAt, comment, createdBy, silencedAlerts } = silence;
  const styles = useStyles2(getStyles);

  const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
  const startsAtDate = dateMath.parse(startsAt);
  const endsAtDate = dateMath.parse(endsAt);
  const duration = intervalToAbbreviatedDurationString({ start: new Date(startsAt), end: new Date(endsAt) });
  return (
    <div className={styles.container}>
      <div className={styles.title}>Comment</div>
      <div>{comment}</div>
      <div className={styles.title}>Schedule</div>
      <div>{`${startsAtDate?.format(dateDisplayFormat)} - ${endsAtDate?.format(dateDisplayFormat)}`}</div>
      <div className={styles.title}>Duration</div>
      <div> {duration}</div>
      <div className={styles.title}>Created by</div>
      <div> {createdBy}</div>
      <div className={styles.title}>Affected alerts</div>
      <SilencedAlertsTable silencedAlerts={silencedAlerts} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: grid;
    grid-template-columns: 1fr 9fr;
    grid-row-gap: 1rem;
  `,
  title: css`
    color: ${theme.colors.text.primary};
  `,
  row: css`
    margin: ${theme.spacing(1, 0)};
  `,
});
