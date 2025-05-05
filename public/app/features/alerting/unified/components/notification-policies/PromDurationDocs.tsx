import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { TimeOptions } from '../../types/time';

export function PromDurationDocs() {
  const styles = useStyles2(getPromDurationStyles);
  return (
    <div>
      <Trans i18nKey="alerting.prom-duration-docs.explanation">
        Prometheus duration format consist of a number followed by a time unit.
      </Trans>
      <br />
      <Trans i18nKey="alerting.prom-duration-docs.different-units">
        Different units can be combined for more granularity.
      </Trans>
      <hr />
      <div className={styles.list}>
        <div className={styles.header}>
          <div>
            <Trans i18nKey="alerting.prom-duration-docs.symbol">Symbol</Trans>
          </div>
          <div>
            <Trans i18nKey="alerting.prom-duration-docs.time-unit">Time unit</Trans>
          </div>
          <div>
            <Trans i18nKey="alerting.prom-duration-docs.example">Example</Trans>
          </div>
        </div>
        <PromDurationDocsTimeUnit unit={TimeOptions.seconds} name="seconds" example="20s" />
        <PromDurationDocsTimeUnit unit={TimeOptions.minutes} name="minutes" example="10m" />
        <PromDurationDocsTimeUnit unit={TimeOptions.hours} name="hours" example="4h" />
        <PromDurationDocsTimeUnit unit={TimeOptions.days} name="days" example="3d" />
        <PromDurationDocsTimeUnit unit={TimeOptions.weeks} name="weeks" example="2w" />
        <div className={styles.examples}>
          <div>
            <Trans i18nKey="alerting.prom-duration-docs.multiple-units-combined">Multiple units combined</Trans>
          </div>
          {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
          <code>1m30s, 2h30m20s, 1w2d</code>
        </div>
      </div>
    </div>
  );
}

function PromDurationDocsTimeUnit({ unit, name, example }: { unit: TimeOptions; name: string; example: string }) {
  const styles = useStyles2(getPromDurationStyles);

  return (
    <>
      <div className={styles.unit}>{unit}</div>
      <div>{name}</div>
      <code>{example}</code>
    </>
  );
}

const getPromDurationStyles = (theme: GrafanaTheme2) => ({
  unit: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  list: css({
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr 2fr',
    gap: theme.spacing(1, 3),
  }),
  header: css({
    display: 'contents',
    fontWeight: theme.typography.fontWeightBold,
  }),
  examples: css({
    display: 'contents',
    '& > div': {
      gridColumn: '1 / span 2',
    },
  }),
});
