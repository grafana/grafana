import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

type ColorKey = 'firing' | 'pending' | 'recovering' | 'healthy' | 'nodata' | 'error';

interface StateCount {
  count: number;
  label: string;
  colorKey: ColorKey;
  field: keyof AlertRuleSearchHit;
}

interface RuleInstanceCountsProps {
  searchHit: AlertRuleSearchHit;
}

export function RuleInstanceCounts({ searchHit }: RuleInstanceCountsProps) {
  const styles = useStyles2(getStyles);

  const stateDefs: StateCount[] = [
    {
      count: searchHit.totalsFiring ?? 0,
      label: t('alerting.gma-rule-list.instances.firing', 'firing'),
      colorKey: 'firing',
      field: 'totalsFiring',
    },
    {
      count: searchHit.totalsPending ?? 0,
      label: t('alerting.gma-rule-list.instances.pending', 'pending'),
      colorKey: 'pending',
      field: 'totalsPending',
    },
    {
      count: searchHit.totalsRecovering ?? 0,
      label: t('alerting.gma-rule-list.instances.recovering', 'recovering'),
      colorKey: 'recovering',
      field: 'totalsRecovering',
    },
    {
      count: searchHit.totalsHealthy ?? 0,
      label: t('alerting.gma-rule-list.instances.healthy', 'healthy'),
      colorKey: 'healthy',
      field: 'totalsHealthy',
    },
    {
      count: searchHit.totalsNoData ?? 0,
      label: t('alerting.gma-rule-list.instances.nodata', 'no data'),
      colorKey: 'nodata',
      field: 'totalsNoData',
    },
    {
      count: searchHit.totalsError ?? 0,
      label: t('alerting.gma-rule-list.instances.error', 'error'),
      colorKey: 'error',
      field: 'totalsError',
    },
  ].filter(({ field, count }) => searchHit[field] !== undefined && count > 0);

  if (stateDefs.length === 0) {
    return null;
  }

  const href = grafanaRulesNav.viewLink(searchHit.uid) + '?tab=instances';

  return (
    <a
      href={href}
      aria-label={t('alerting.gma-rule-list.instances.view-instances', 'View instances')}
      className={styles.link}
    >
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="layers-alt" size="xs" className={styles.icon} />
        {stateDefs.map(({ count, label, colorKey }) => (
          <span key={colorKey} className={styles.badge[colorKey]}>
            {count} {label}
          </span>
        ))}
      </Stack>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const badge = (color: string, bg: string) =>
    css({
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      padding: `1px ${theme.spacing(0.75)}`,
      borderRadius: theme.shape.radius.default,
      color,
      background: bg,
    });

  return {
    link: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      textDecoration: 'none',
      borderRadius: theme.shape.radius.default,
      padding: `1px ${theme.spacing(0.25)}`,
      '&:hover': { background: theme.colors.action.hover },
    }),
    icon: css({ color: theme.colors.text.secondary }),
    badge: {
      firing: badge(theme.colors.error.text, theme.colors.error.transparent),
      pending: badge(theme.colors.warning.text, theme.colors.warning.transparent),
      recovering: badge(theme.colors.info.text, theme.colors.info.transparent),
      healthy: badge(theme.colors.success.text, theme.colors.success.transparent),
      nodata: badge(theme.colors.text.secondary, theme.colors.background.secondary),
      error: badge(theme.colors.error.text, theme.colors.error.transparent),
    },
  };
};
