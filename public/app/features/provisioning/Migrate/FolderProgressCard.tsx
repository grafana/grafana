import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { SemicircleGauge } from './SemicircleGauge';
import { getSharedCardStyles } from './statCardStyles';

interface FolderProgressCardProps {
  managed: number;
  total: number;
}

export function FolderProgressCard({ managed, total }: FolderProgressCardProps) {
  const styles = useStyles2(getStyles);
  const pct = total === 0 ? 0 : managed / total;
  return (
    <div className={cx(styles.card, styles.gaugeCard)}>
      <Text variant="body" weight="medium" color="success">
        <Trans i18nKey="provisioning.migrate.folder-progress-label">Folders managed</Trans>
      </Text>
      <SemicircleGauge pct={pct} />
      <span className={styles.value}>
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
  ...getSharedCardStyles(theme),
  gaugeCard: css({
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: theme.spacing(0.25),
  }),
});
