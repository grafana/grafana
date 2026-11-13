import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LoadingPlaceholder, Text, TextLink, useStyles2 } from '@grafana/ui';

import { createRelativeUrl } from '../../utils/url';

import { describeHomeRange } from './homeRange';
import { useMissedEvaluations } from './useHomeData';

/** The rules that missed the most evaluations in the range, from the Grafana Cloud usage metrics. */
export function MissedEvaluationsTable({ range }: { range: TimeRange }) {
  const styles = useStyles2(getStyles);
  const missed = useMissedEvaluations(range);
  const rules = missed.value ?? [];
  const most = Math.max(1, ...rules.map((rule) => rule.missed));

  return (
    <section className={styles.card} aria-labelledby="home-missed-evaluations">
      <div className={styles.header}>
        <Text element="h3" variant="h5" id="home-missed-evaluations">
          <Trans i18nKey="alerting.home.missed-evaluations.title">Rules that missed the most</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          {t('alerting.home.missed-evaluations.subtitle', 'Missed evaluations · {{range}}', {
            range: describeHomeRange(range),
          })}
        </Text>
      </div>
      {missed.loading && <LoadingPlaceholder text={t('alerting.home.missed-evaluations.loading', 'Loading...')} />}
      {!missed.loading && rules.length === 0 && (
        <Text color="secondary">
          <Trans i18nKey="alerting.home.missed-evaluations.empty">
            No rule missed an evaluation in this time range.
          </Trans>
        </Text>
      )}
      {rules.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rank} aria-hidden="true" />
                <th className={styles.left}>
                  <Trans i18nKey="alerting.home.missed-evaluations.rule">Rule</Trans>
                </th>
                <th className={styles.barCell} aria-hidden="true" />
                <th className={styles.numeric}>
                  <Trans i18nKey="alerting.home.missed-evaluations.missed">Missed</Trans>
                </th>
                <th className={styles.numeric}>
                  <Trans i18nKey="alerting.home.missed-evaluations.share">Share</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.title}>
                  <td className={cx(styles.rank, styles.secondary)}>{index + 1}</td>
                  <td className={styles.name}>
                    <TextLink
                      href={createRelativeUrl('/alerting/list', { search: `rule:"${rule.title}"` })}
                      inline={false}
                    >
                      {rule.title}
                    </TextLink>
                  </td>
                  <td className={styles.barCell} aria-hidden="true">
                    <span className={styles.track}>
                      <span className={styles.bar} style={{ width: `${(rule.missed / most) * 100}%` }} />
                    </span>
                  </td>
                  <td className={cx(styles.numeric, styles.strong)}>{rule.missed.toLocaleString()}</td>
                  <td className={cx(styles.numeric, styles.secondary)}>
                    {t('alerting.home.missed-evaluations.share-value', '{{share}}%', {
                      share: Math.round(rule.share * 100),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.home.missed-evaluations.note">
              Share is of all missed evaluations in the range. Opening a rule filters the rule list by its title, since
              the series carries the title only.
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
    height: '100%',
    minWidth: 0,
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
    '& td': { padding: theme.spacing(1), borderTop: `1px solid ${theme.colors.border.weak}` },
  }),
  left: css({ textAlign: 'left' }),
  rank: css({ width: theme.spacing(3) }),
  secondary: css({ color: theme.colors.text.secondary }),
  name: css({ maxWidth: 0, width: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
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
    background: theme.colors.warning.main,
  }),
  numeric: css({ textAlign: 'right', width: 72, whiteSpace: 'nowrap' }),
  strong: css({ fontWeight: theme.typography.fontWeightMedium }),
});
