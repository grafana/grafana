import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { SemicircleGauge } from './SemicircleGauge';

export function FolderProgressCard({ managed, total }: { managed: number; total: number }) {
  const styles = useStyles2(getStyles);
  const pct = total === 0 ? 0 : managed / total;
  return (
    <div className={cx(styles.statCard, styles.gaugeCard)}>
      <span className={cx(styles.statCardLabel, styles.statCardTone_success)}>
        <Trans i18nKey="provisioning.migrate.folder-progress-label">Folders managed</Trans>
      </span>
      <SemicircleGauge pct={pct} />
      <span className={styles.statCardValue}>
        {t('provisioning.migrate.folder-progress-fraction', '{{managed}} / {{total}}', { managed, total })}
      </span>
      <Text color="secondary" variant="body">
        {t('provisioning.migrate.folder-progress-pct', '{{pct}}% complete', {
          pct: Math.round(pct * 100),
        })}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statCard: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.secondary,
    alignItems: 'center',
    boxShadow: theme.shadows.z1,
  }),
  gaugeCard: css({
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: theme.spacing(0.25),
  }),
  statCardLabel: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  statCardTone_success: css({
    color: theme.colors.success.text,
  }),
  statCardValue: css({
    fontSize: '44px',
    lineHeight: 1.1,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
    letterSpacing: '-0.5px',
  }),
});
