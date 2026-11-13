import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { alertmanagerApi } from '../../api/alertmanagerApi';

import { type DeliverySummary } from './deliverySummary';
import { describeHomeRange } from './homeRange';
import { CHART_HEIGHT } from './layout';

// At or above this failure rate a channel is shown as failing rather than degraded.
const FAILING_RATE = 0.01;

type ChannelHealth = 'failing' | 'degraded' | 'healthy';

function getChannelHealth(rate: number, failed: number): ChannelHealth {
  if (rate >= FAILING_RATE) {
    return 'failing';
  }
  return failed > 0 ? 'degraded' : 'healthy';
}

export function DeliveryByChannel({ delivery, range }: { delivery: DeliverySummary; range: TimeRange }) {
  const styles = useStyles2(getStyles);
  const { data: notifiers } = alertmanagerApi.useGrafanaNotifiersQuery();
  const names = useMemo(
    () => new Map<string, string>(notifiers?.map((notifier) => [notifier.type, notifier.name])),
    [notifiers]
  );
  const maxAttempts = Math.max(1, ...delivery.channels.map((channel) => channel.attempts));

  return (
    <section className={styles.card} aria-labelledby="home-delivery-by-channel">
      <div className={styles.header}>
        <Text element="h3" variant="h5" id="home-delivery-by-channel">
          <Trans i18nKey="alerting.home.delivery-by-channel.title">Delivery by channel</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          {t('alerting.home.delivery-by-channel.subtitle', 'Notification attempts · {{range}}', {
            range: describeHomeRange(range),
          })}
        </Text>
      </div>
      {delivery.channels.length === 0 ? (
        <Text color="secondary">
          <Trans i18nKey="alerting.home.delivery-by-channel.empty">
            No notifications were sent in this time range.
          </Trans>
        </Text>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.dotCell} aria-hidden="true" />
                <th className={styles.left}>
                  <Trans i18nKey="alerting.home.delivery-by-channel.channel">Channel</Trans>
                </th>
                <th className={cx(styles.left, styles.barCell)}>
                  <Trans i18nKey="alerting.home.delivery-by-channel.volume">Volume</Trans>
                </th>
                <th className={styles.numeric}>
                  <Trans i18nKey="alerting.home.delivery-by-channel.attempts">Attempts</Trans>
                </th>
                <th className={styles.numeric}>
                  <Trans i18nKey="alerting.home.delivery-by-channel.failed">Failed</Trans>
                </th>
                <th className={styles.numeric}>
                  <Trans i18nKey="alerting.home.delivery-by-channel.failure-rate">Failure rate</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {delivery.channels.map((channel) => {
                const rate = channel.attempts ? channel.failed / channel.attempts : 0;
                const health = getChannelHealth(rate, channel.failed);
                return (
                  <tr key={channel.integration}>
                    <td className={styles.dotCell} aria-hidden="true">
                      <span className={cx(styles.dot, styles.health[health])} />
                    </td>
                    <td className={styles.name}>{names.get(channel.integration) ?? channel.integration}</td>
                    <td className={styles.barCell} aria-hidden="true">
                      <span className={styles.track}>
                        <span className={styles.bar} style={{ width: `${(channel.attempts / maxAttempts) * 100}%` }} />
                      </span>
                    </td>
                    <td className={cx(styles.numeric, styles.strong)}>{channel.attempts.toLocaleString()}</td>
                    <td className={cx(styles.numeric, channel.failed > 0 && styles.failed)}>
                      {channel.failed.toLocaleString()}
                    </td>
                    <td className={cx(styles.numeric, styles.rate[health])}>
                      {t('alerting.home.delivery-by-channel.rate', '{{rate}}%', { rate: (rate * 100).toFixed(2) })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.home.delivery-by-channel.note">
              Sorted by failures, so channels with problems come first. Attempts include retries.
            </Trans>
          </Text>
        </>
      )}
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    // Exactly as tall as the charts beside it; more channels than fit scroll.
    height: CHART_HEIGHT,
    overflowY: 'auto',
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    '& th': {
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(0, 1, 0.75),
    },
    '& td': {
      padding: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  left: css({ textAlign: 'left' }),
  dotCell: css({ width: theme.spacing(2) }),
  dot: css({
    display: 'block',
    width: 9,
    height: 9,
    borderRadius: theme.shape.radius.circle,
  }),
  health: {
    failing: css({ background: theme.colors.error.main }),
    degraded: css({ background: theme.colors.warning.main }),
    healthy: css({ background: theme.colors.success.main }),
  },
  name: css({ whiteSpace: 'nowrap' }),
  barCell: css({ width: '30%', [theme.breakpoints.down('sm')]: { display: 'none' } }),
  track: css({
    display: 'block',
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.canvas,
    overflow: 'hidden',
  }),
  bar: css({
    display: 'block',
    height: '100%',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.info.main,
  }),
  // Narrow, right-aligned number columns keep each figure under its heading.
  numeric: css({ textAlign: 'right', width: 88, whiteSpace: 'nowrap' }),
  strong: css({ fontWeight: theme.typography.fontWeightMedium }),
  failed: css({ color: theme.colors.error.text, fontWeight: theme.typography.fontWeightMedium }),
  rate: {
    failing: css({ color: theme.colors.error.text, fontWeight: theme.typography.fontWeightMedium }),
    degraded: css({ color: theme.colors.warning.text }),
    healthy: css({ color: theme.colors.text.secondary }),
  },
});
