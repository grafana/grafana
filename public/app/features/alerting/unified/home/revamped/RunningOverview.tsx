import { css } from '@emotion/css';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2, type TimeRange, store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { rulesNav } from '../../utils/navigation';

import { type AttentionItem, getAttentionItems } from './attentionItems';
import { type DeliverySummary } from './deliverySummary';
import { type GrafanaRulesSummary, HOME_RULE_LIMIT, type InstanceCounts } from './grafanaRulesSummary';
import { describeHomeRange } from './homeRange';
import { type SilencesSummary } from './useHomeData';

interface RunningOverviewProps {
  rules: GrafanaRulesSummary;
  silences?: SilencesSummary;
  delivery?: DeliverySummary;
  /** Without Grafana Cloud usage metrics there are no history charts, so the page points to Alert activity. */
  usageMetricsAvailable?: boolean;
  range: TimeRange;
}

type Tone = 'error' | 'warning' | 'success' | 'info' | 'neutral';

export function getAttentionDismissedKey(orgId: number): string {
  return `grafana.alerting.home.attention.dismissed-org-${orgId}`;
}

/** The home page for a stack that has Grafana-managed rules. */
export function RunningOverview({
  rules,
  silences,
  delivery,
  usageMetricsAvailable = false,
  range,
}: RunningOverviewProps) {
  const styles = useStyles2(getStyles);
  const key = getAttentionDismissedKey(config.bootData.user.orgId);
  const [dismissed, setDismissed] = useState<string[]>(() => store.getObject<string[]>(key, []));

  const items = useMemo(
    () => getAttentionItems({ rules, silences, delivery }).filter((item) => !dismissed.includes(item.id)),
    [rules, silences, delivery, dismissed]
  );

  const dismiss = useCallback(
    (id: string) => {
      const next = [...dismissed, id];
      store.setObject(key, next);
      setDismissed(next);
    },
    [dismissed, key]
  );

  return (
    <Stack direction="column" gap={2}>
      <Verdict items={items} />
      {rules.capped && (
        <Text color="secondary" variant="bodySmall">
          {t('alerting.home.overview.capped', 'Based on the first {{limit}} rules.', {
            limit: HOME_RULE_LIMIT.toLocaleString(),
          })}
        </Text>
      )}
      <div className={styles.tiles}>
        <Tile
          label={t('alerting.home.tiles.active-rules', 'Active rules')}
          value={rules.activeRules}
          hint={t('alerting.home.tiles.active-rules-hint', 'evaluating now')}
        />
        <Tile
          label={t('alerting.home.tiles.failing-rules', 'Rules failing to evaluate')}
          value={rules.failingRules}
          tone={rules.failingRules > 0 ? 'error' : 'success'}
          hint={t('alerting.home.tiles.failing-rules-hint', 'Last evaluation returned an error')}
        />
        {delivery ? (
          <Tile
            label={t('alerting.home.tiles.notifications-delivered', 'Notifications delivered')}
            value={formatDeliveredPercent(delivery)}
            tone={delivery.failed > 0 ? 'warning' : 'success'}
            hint={t(
              'alerting.home.tiles.notifications-delivered-hint',
              '{{attempts}} attempts, {{failed}} failed · {{range}}',
              {
                attempts: delivery.attempts.toLocaleString(),
                failed: delivery.failed.toLocaleString(),
                range: describeHomeRange(range),
              }
            )}
          />
        ) : (
          <Tile
            label={t('alerting.home.tiles.active-silences', 'Active silences')}
            value={silences?.active}
            tone={silences?.expiringSoon ? 'info' : 'neutral'}
            hint={
              silences
                ? t('alerting.home.tiles.active-silences-hint', '', {
                    count: silences.expiringSoon,
                    defaultValue_one: '{{count}} expires in the next 24 hours',
                    defaultValue_other: '{{count}} expire in the next 24 hours',
                  })
                : undefined
            }
          />
        )}
        <Tile
          label={t('alerting.home.tiles.firing', 'Firing instances')}
          value={rules.instances.firing}
          tone="error"
          hint={t('alerting.home.tiles.right-now', 'right now')}
        />
        <Tile
          label={t('alerting.home.tiles.pending', 'Pending instances')}
          value={rules.instances.pending}
          tone="warning"
          hint={t('alerting.home.tiles.right-now', 'right now')}
        />
        <Tile
          label={t('alerting.home.tiles.paused-rules', 'Paused rules')}
          value={rules.pausedRules}
          hint={
            rules.totalRules
              ? t('alerting.home.tiles.paused-rules-hint', '{{percent}}% of all rules', {
                  percent: Math.round((rules.pausedRules / rules.totalRules) * 100),
                })
              : undefined
          }
        />
      </div>
      <div className={styles.columns}>
        <div className={styles.leftColumn}>
          <InstancesByState instances={rules.instances} />
          <TopFiringRules rules={rules} />
          {!usageMetricsAvailable && <LookingForTrends />}
        </div>
        <NeedsAttention items={items} onDismiss={dismiss} />
      </div>
    </Stack>
  );
}

function formatDeliveredPercent({ attempts, failed }: DeliverySummary): string {
  if (attempts === 0) {
    return '–';
  }
  return `${(((attempts - failed) / attempts) * 100).toFixed(2)}%`;
}

function Verdict({ items }: { items: AttentionItem[] }) {
  const styles = useStyles2(getStyles);
  const { isAvailable, openAssistant } = useAssistant();
  const count = items.length;

  const analyze = useCallback(() => {
    openAssistant?.({
      origin: 'alerting/home-analyze-stack',
      mode: 'assistant',
      prompt: buildAssistantPrompt(items),
      autoSend: true,
    });
  }, [items, openAssistant]);

  return (
    <div className={count ? styles.verdictAttention : styles.verdictHealthy} role="status">
      <span className={styles.dot} style={{ background: count ? styles.colors.warning : styles.colors.success }} />
      <Text weight="medium">
        {count
          ? t('alerting.home.verdict.attention', '', {
              count,
              defaultValue_one: '{{count}} thing needs attention',
              defaultValue_other: '{{count}} things need attention',
            })
          : t('alerting.home.verdict.healthy', 'Alerting is healthy')}
      </Text>
      <Text color="secondary">
        <Trans i18nKey="alerting.home.verdict.basis">Based on rule health, current alert state and silences.</Trans>
      </Text>
      {count > 0 && isAvailable && openAssistant && (
        <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={analyze} className={styles.pushRight}>
          <Trans i18nKey="alerting.home.verdict.analyze">Analyze with Assistant</Trans>
        </Button>
      )}
    </div>
  );
}

export function buildAssistantPrompt(items: AttentionItem[]): string {
  const list = items.map((item) => `- ${item.title}: ${item.description}`).join('\n');
  return [
    "Assess the overall health of this stack's Grafana-managed alerting and raise any issues.",
    'Start with these items that need attention and say what to do about each:',
    list,
  ].join('\n');
}

function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value?: number | string;
  hint?: string;
  tone?: Tone;
}) {
  const styles = useStyles2(getStyles);
  const display = typeof value === 'number' ? value.toLocaleString() : (value ?? '–');

  return (
    <section className={styles.tile} aria-label={label}>
      <span className={styles.tileLabel}>
        <span className={styles.dot} style={{ background: styles.colors[tone] }} />
        {label}
      </span>
      <span className={styles.tileValue}>{display}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </section>
  );
}

/** A card with a title on the left and a short qualifier, such as the time it covers, on the right. */
function SectionCard({
  id,
  title,
  meta,
  grow = false,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  /** Take the spare height of its column. */
  grow?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles2(getStyles);

  return (
    <section className={grow ? styles.growCard : styles.card} aria-labelledby={id}>
      <div className={styles.cardHeader}>
        <Text element="h3" variant="h5" id={id}>
          {title}
        </Text>
        {meta && (
          <Text color="secondary" variant="bodySmall">
            {meta}
          </Text>
        )}
      </div>
      {children}
    </section>
  );
}

function LookingForTrends() {
  return (
    <SectionCard id="home-looking-for-trends" title={t('alerting.home.trends.title', 'Looking for trends?')}>
      <Text color="secondary">
        <Trans i18nKey="alerting.home.trends.body">
          Charts of firing and evaluation history need the Grafana Cloud usage metrics.{' '}
          <TextLink href="/alerting/alerts" inline>
            Alert activity
          </TextLink>{' '}
          shows what fired and when, if you have state history set up.
        </Trans>
      </Text>
    </SectionCard>
  );
}

function InstancesByState({ instances }: { instances: InstanceCounts }) {
  const styles = useStyles2(getStyles);
  const states: Array<{ key: keyof InstanceCounts; label: string; color: string }> = [
    { key: 'firing', label: t('alerting.home.states.firing', 'Firing'), color: styles.colors.error },
    { key: 'pending', label: t('alerting.home.states.pending', 'Pending'), color: styles.colors.warning },
    { key: 'recovering', label: t('alerting.home.states.recovering', 'Recovering'), color: styles.colors.info },
    { key: 'noData', label: t('alerting.home.states.no-data', 'No data'), color: styles.colors.neutral },
    { key: 'error', label: t('alerting.home.states.error', 'Error'), color: styles.colors.error },
    { key: 'normal', label: t('alerting.home.states.normal', 'Normal'), color: styles.colors.success },
  ];
  const total = states.reduce((sum, state) => sum + instances[state.key], 0);
  // Zero states get no segment, otherwise the bar's minimum segment width would show them as slivers.
  const segments = states.filter((state) => instances[state.key] > 0);
  const barLabel = segments.map((state) => `${state.label} ${instances[state.key]}`).join(', ');

  return (
    <SectionCard
      id="home-instances-by-state"
      title={t('alerting.home.instances-by-state.title', 'Alert instances by state')}
      meta={t('alerting.home.tiles.right-now', 'right now')}
    >
      {total > 0 && (
        <div className={styles.stateBar} role="img" aria-label={barLabel}>
          {segments.map((state) => (
            <span
              key={state.key}
              style={{ width: `${(instances[state.key] / total) * 100}%`, background: state.color }}
            />
          ))}
        </div>
      )}
      <ul className={styles.stateLegend}>
        {states.map((state) => (
          <li key={state.key}>
            <span className={styles.dot} style={{ background: state.color }} />
            {state.label} <strong>{instances[state.key].toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function TopFiringRules({ rules }: { rules: GrafanaRulesSummary }) {
  const styles = useStyles2(getStyles);

  return (
    <SectionCard
      grow
      id="home-top-firing-rules"
      title={t('alerting.home.top-firing-rules.title', 'Top firing rules')}
      meta={t('alerting.home.tiles.right-now', 'right now')}
    >
      {rules.topFiringRules.length === 0 ? (
        <Text color="secondary">
          <Trans i18nKey="alerting.home.top-firing-rules.empty">No rules are firing right now.</Trans>
        </Text>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <Trans i18nKey="alerting.home.top-firing-rules.rule">Rule</Trans>
              </th>
              <th className={styles.numeric}>
                <Trans i18nKey="alerting.home.top-firing-rules.firing">Firing instances</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.topFiringRules.map((rule) => (
              <tr key={rule.uid}>
                <td>
                  <TextLink
                    href={rulesNav.detailsPageLink(
                      GRAFANA_RULES_SOURCE_NAME,
                      { ruleSourceName: 'grafana', uid: rule.uid },
                      undefined,
                      { skipSubPath: true }
                    )}
                    inline={false}
                  >
                    {rule.name}
                  </TextLink>
                </td>
                <td className={styles.numeric}>{rule.firing.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

function NeedsAttention({ items, onDismiss }: { items: AttentionItem[]; onDismiss: (id: string) => void }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.attentionWrap}>
      <section className={styles.attentionCard} aria-labelledby="home-needs-attention">
        <Stack justifyContent="space-between" alignItems="center">
          <Text element="h3" variant="h5" id="home-needs-attention">
            <Trans i18nKey="alerting.home.needs-attention.title">Needs attention</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            {t('alerting.home.needs-attention.open', '', {
              count: items.length,
              defaultValue_one: '{{count}} open',
              defaultValue_other: '{{count}} open',
            })}
          </Text>
        </Stack>
        <div className={styles.attentionScroll}>
          {items.length === 0 ? (
            <Text color="secondary">
              <Trans i18nKey="alerting.home.needs-attention.empty">Nothing needs attention right now.</Trans>
            </Text>
          ) : (
            <ul className={styles.attentionList}>
              {items.map((item) => (
                <li key={item.id} className={styles.attentionItem}>
                  <span className={styles.attentionDot} style={{ background: styles.colors[item.severity] }} />
                  <Stack direction="column" gap={0.5}>
                    <Text weight="medium">{item.title}</Text>
                    <Text color="secondary" variant="bodySmall">
                      {item.description}
                    </Text>
                    <Stack gap={1.5} alignItems="center">
                      <TextLink href={item.href} inline={false} variant="bodySmall">
                        {item.actionLabel}
                      </TextLink>
                      <Button
                        size="sm"
                        variant="secondary"
                        fill="text"
                        onClick={() => onDismiss(item.id)}
                        aria-label={t('alerting.home.needs-attention.dismiss-label', 'Dismiss "{{title}}"', {
                          title: item.title,
                        })}
                      >
                        <Trans i18nKey="alerting.home.needs-attention.dismiss">Dismiss</Trans>
                      </Button>
                    </Stack>
                  </Stack>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const card = css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minWidth: 0,
  });

  const verdict = css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1, 2),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.radius.default,
  });

  return {
    colors: {
      error: theme.colors.error.main,
      warning: theme.colors.warning.main,
      info: theme.colors.info.main,
      success: theme.colors.success.main,
      neutral: theme.colors.text.disabled,
    },
    card,
    growCard: css(card, { flex: 1 }),
    // Tall enough for about four Needs attention items before that list starts scrolling.
    leftColumn: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      minHeight: 440,
      [theme.breakpoints.down('lg')]: { minHeight: 0 },
    }),
    cardHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
    }),
    tile: css({
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1.5, 2),
      display: 'grid',
      gap: theme.spacing(0.25),
      alignContent: 'start',
      minWidth: 0,
    }),
    tileLabel: css({
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    tileValue: css({
      fontSize: theme.typography.h2.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1.2,
      fontVariantNumeric: 'tabular-nums',
    }),
    tileHint: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    attentionItem: css({
      display: 'grid',
      gridTemplateColumns: `${theme.spacing(1.5)} minmax(0, 1fr)`,
      gap: theme.spacing(1),
      alignItems: 'start',
    }),
    attentionDot: css({
      width: 9,
      height: 9,
      borderRadius: theme.shape.radius.circle,
      marginTop: theme.spacing(0.75),
    }),
    verdictAttention: css(verdict, {
      background: theme.colors.warning.transparent,
      border: `1px solid ${theme.colors.warning.border}`,
    }),
    verdictHealthy: css(verdict, {
      background: theme.colors.success.transparent,
      border: `1px solid ${theme.colors.success.border}`,
    }),
    pushRight: css({ marginLeft: 'auto' }),
    tiles: css({
      display: 'grid',
      gap: theme.spacing(1.5),
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      [theme.breakpoints.down('md')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    }),
    columns: css({
      display: 'grid',
      gap: theme.spacing(2),
      gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
      alignItems: 'stretch',
      [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
    }),
    // The left column sets the row height; the attention list fills it and scrolls when longer.
    attentionWrap: css({
      position: 'relative',
      minWidth: 0,
      [theme.breakpoints.down('lg')]: { position: 'static' },
    }),
    attentionCard: css(card, {
      position: 'absolute',
      inset: 0,
      [theme.breakpoints.down('lg')]: { position: 'static' },
    }),
    attentionScroll: css({
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      [theme.breakpoints.down('lg')]: { maxHeight: 420 },
    }),
    attentionList: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      '& > li': {
        padding: theme.spacing(1.5, 0),
        borderTop: `1px solid ${theme.colors.border.weak}`,
      },
      '& > li:first-child': { borderTop: 'none', paddingTop: 0 },
    }),
    stateBar: css({
      display: 'flex',
      gap: 2,
      height: theme.spacing(1.5),
      borderRadius: theme.shape.radius.pill,
      overflow: 'hidden',
      '& > span': { minWidth: 2 },
    }),
    stateLegend: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: theme.spacing(1),
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    }),
    dot: css({
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: theme.shape.radius.circle,
      marginRight: theme.spacing(0.75),
    }),
    table: css({
      width: '100%',
      borderCollapse: 'collapse',
      '& th': { textAlign: 'left', color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeightMedium },
      '& th, & td': { padding: theme.spacing(1), borderTop: `1px solid ${theme.colors.border.weak}` },
    }),
    numeric: css({ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }),
  };
};
