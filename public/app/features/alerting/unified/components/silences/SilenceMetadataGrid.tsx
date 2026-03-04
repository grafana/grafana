import { css } from '@emotion/css';

import { GrafanaTheme2, dateTimeFormat, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

interface SilenceMetadataGridProps {
  startsAt: string;
  endsAt: string;
  comment: string;
  createdBy: string;
}

export function SilenceMetadataGrid({ startsAt, endsAt, comment, createdBy }: SilenceMetadataGridProps) {
  const styles = useStyles2(getStyles);
  const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
  const startsAtDate = dateTimeFormat(startsAt, { format: dateDisplayFormat });
  const endsAtDate = dateTimeFormat(endsAt, { format: dateDisplayFormat });
  const duration = intervalToAbbreviatedDurationString({
    start: new Date(startsAt),
    end: new Date(endsAt),
  });

  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <Trans i18nKey="alerting.silence-details.comment">Comment</Trans>
      </div>
      <div>{comment}</div>
      <div className={styles.label}>
        <Trans i18nKey="alerting.silence-details.schedule">Schedule</Trans>
      </div>
      <div>{`${startsAtDate} - ${endsAtDate}`}</div>
      <div className={styles.label}>
        <Trans i18nKey="alerting.silence-details.duration">Duration</Trans>
      </div>
      <div>{duration}</div>
      <div className={styles.label}>
        <Trans i18nKey="alerting.silence-details.created-by">Created by</Trans>
      </div>
      <div>{createdBy}</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'grid',
    gridTemplateColumns: '1fr 9fr',
    gridRowGap: '1rem',
    paddingBottom: theme.spacing(2),
  }),
  label: css({
    color: theme.colors.text.primary,
  }),
});
