import { css } from '@emotion/css';

import { GrafanaTheme2, dateMath, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
      <div className={styles.title}>
        <Trans i18nKey="alerting.silence-details.comment">Comment</Trans>
      </div>
      <div>{comment}</div>
      <div className={styles.title}>
        <Trans i18nKey="alerting.silence-details.schedule">Schedule</Trans>
      </div>
      <div>{`${startsAtDate?.format(dateDisplayFormat)} - ${endsAtDate?.format(dateDisplayFormat)}`}</div>
      <div className={styles.title}>
        <Trans i18nKey="alerting.silence-details.duration">Duration</Trans>
      </div>
      <div>{duration}</div>
      <div className={styles.title}>
        <Trans i18nKey="alerting.silence-details.created-by">Created by</Trans>
      </div>
      <div>{createdBy}</div>
      {Array.isArray(silencedAlerts) && (
        <>
          <div className={styles.title}>
            <Trans i18nKey="alerting.silence-details.affected-alerts">Affected alerts</Trans>
          </div>
          <SilencedAlertsTable silencedAlerts={silencedAlerts} />
        </>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'grid',
    gridTemplateColumns: '1fr 9fr',
    gridRowGap: '1rem',
    paddingBottom: theme.spacing(2),
  }),
  title: css({
    color: theme.colors.text.primary,
  }),
  row: css({
    margin: theme.spacing(1, 0),
  }),
});
