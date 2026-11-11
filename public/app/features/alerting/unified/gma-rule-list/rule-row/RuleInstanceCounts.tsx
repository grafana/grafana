import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

/** Keys of AlertRuleSearchHit that carry per-state instance totals. Adding a new totals* field
 * to AlertRuleSearchHit automatically expands this type, causing compile errors in TOTALS_FIELDS,
 * labels, and badge until all three are updated. */
type TotalsField = Extract<keyof AlertRuleSearchHit, `totals${string}`>;

/** 'totalsFiring' → 'firing', 'totalsNoData' → 'nodata', etc. */
type InstanceState = Lowercase<TotalsField extends `totals${infer S}` ? S : never>;

/** Maps each state to the search-hit field that carries its count. */
const TOTALS_FIELDS: Record<InstanceState, TotalsField> = {
  firing: 'totalsFiring',
  pending: 'totalsPending',
  recovering: 'totalsRecovering',
  healthy: 'totalsHealthy',
  nodata: 'totalsNoData',
  error: 'totalsError',
};

/** Iteration order for display. */
const INSTANCE_STATES: readonly InstanceState[] = ['firing', 'pending', 'recovering', 'healthy', 'nodata', 'error'];

interface RuleInstanceCountsProps {
  searchHit: AlertRuleSearchHit;
}

export function RuleInstanceCounts({ searchHit }: RuleInstanceCountsProps) {
  const styles = useStyles2(getStyles);

  const labels: Record<InstanceState, string> = {
    firing: t('alerting.gma-rule-list.instances.firing', 'firing'),
    pending: t('alerting.gma-rule-list.instances.pending', 'pending'),
    recovering: t('alerting.gma-rule-list.instances.recovering', 'recovering'),
    healthy: t('alerting.gma-rule-list.instances.healthy', 'normal'),
    nodata: t('alerting.gma-rule-list.instances.nodata', 'no data'),
    error: t('alerting.gma-rule-list.instances.error', 'error'),
  };

  const stateDefs = INSTANCE_STATES.map((state) => ({ state, count: searchHit[TOTALS_FIELDS[state]] })).filter(
    (entry): entry is { state: InstanceState; count: number } => entry.count !== undefined && entry.count > 0
  );

  if (stateDefs.length === 0) {
    return null;
  }

  const href = grafanaRulesNav.viewLink(searchHit.uid) + '?tab=instances';
  const viewLabel = t('alerting.gma-rule-list.instances.view-instances', 'View instances');

  return (
    <Tooltip content={viewLabel} placement="top">
      <TextLink href={href} aria-label={viewLabel} inline={false}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="layers-alt" size="xs" className={styles.icon} />
          {stateDefs.map(({ state, count }) => (
            <span key={state} className={styles.badge[state]}>
              {count} {labels[state]}
            </span>
          ))}
        </Stack>
      </TextLink>
    </Tooltip>
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
