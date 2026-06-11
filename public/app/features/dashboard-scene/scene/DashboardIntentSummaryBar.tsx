import { css } from '@emotion/css';
import { useEffect, useReducer, useRef, useState } from 'react';
import { type Unsubscribable } from 'rxjs';

import { BusEventWithPayload, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Icon, IconButton, Input, Stack, TextArea, Tooltip, useStyles2 } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';
import {
  type AggregatedPanelIntent,
  type AnomalousPanel,
  dashboardSceneGraph,
} from '../utils/dashboardSceneGraph';

import { type DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

type DashboardIntent = NonNullable<DashboardScene['state']['intent']>;

/**
 * Payload broadcasting which panels are currently matching a declared failure
 * mode. Published on the Grafana AppEvents bus so the (separately-mounted)
 * Assistant plugin can offer match-aware starter suggestions in its drawer.
 * The event `type` string is shared verbatim with the plugin subscriber.
 */
interface DashboardIntentActiveMatchesPayload {
  dashboardUid: string;
  matches: AnomalousPanel[];
}
export class DashboardIntentActiveMatchesEvent extends BusEventWithPayload<DashboardIntentActiveMatchesPayload> {
  static type = 'grafana-assistant:dashboard-intent-active-matches';
}

/**
 * A compact, always-on summary of a dashboard's operational intent.
 *
 * Owner and purpose are dashboard-level fields the author edits inline here
 * (stored on `dashboard.state.intent`). Failure modes and runbooks are a
 * read-only roll-up of the intent declared on the panels below — the header is
 * where an SRE scanning a dashboard cold sees, in one place, what the dashboard
 * is for, who owns it, and which failure patterns the panels are watching for.
 *
 * Renders nothing until some intent exists anywhere in the dashboard (a panel
 * with intent, or an author-entered owner/purpose). A blank dashboard shows no
 * header at all.
 */
export function DashboardIntentSummaryBar({ dashboard }: Props) {
  const { intent, isEditing } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const aggregated = useAggregatedPanelIntent(dashboard);
  const anomalousPanels = dashboardSceneGraph.getAnomalousPanels(dashboard);
  // Tags currently matching on at least one breaching panel — used to redden
  // the corresponding chips in the failure-modes row.
  const matchedTags = new Set(anomalousPanels.flatMap((p) => p.tags));

  const [collapsed, setCollapsed] = useState(false);

  const dashboardHasContent = hasDashboardContent(intent);
  const aggregatedHasContent = aggregated.failureModes.length > 0 || aggregated.runbooks.length > 0;

  // Broadcast active matches to the Assistant plugin (separately mounted) so it
  // can surface match-aware starter suggestions. Keyed by a stable serialization
  // so we only publish when the set of matches actually changes.
  const uid = dashboard.state.uid ?? '';
  const matchesKey = JSON.stringify(anomalousPanels);
  useEffect(() => {
    getAppEvents().publish(new DashboardIntentActiveMatchesEvent({ dashboardUid: uid, matches: anomalousPanels }));
    // anomalousPanels is recomputed each render; matchesKey is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, matchesKey]);

  // Visibility gate: never show on a dashboard with no intent anywhere, even in
  // edit mode. The header (and its get-started CTA) only appears once a panel
  // carries intent or an author has typed an owner/purpose.
  if (!dashboardHasContent && !aggregatedHasContent) {
    return null;
  }

  const purpose = intent?.purpose ?? '';
  const owner = intent?.owner ?? '';
  const showGetStarted = Boolean(isEditing) && !purpose && !owner;

  return (
    <div className={styles.wrapper} data-testid="dashboard-intent-summary-bar">
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Tooltip
            content={t(
              'dashboard.intent-summary.info-tooltip',
              'Centralizes all the context entered across this dashboard — purpose, owner, and the failure modes and runbooks declared on its panels.'
            )}
            placement="top"
          >
            <Icon name="info-circle" className={styles.icon} tabIndex={0} />
          </Tooltip>
          <span className={styles.headerLabel}>{t('dashboard.intent-summary.label', 'Dashboard context')}</span>
          {isEditing ? (
            <OwnerInput dashboard={dashboard} value={owner} />
          ) : (
            owner && <OwnerChip owner={owner} provenance={intent?.provenance?.owner} />
          )}
        </Stack>
        <IconButton
          name={collapsed ? 'angle-down' : 'angle-up'}
          aria-label={
            collapsed
              ? t('dashboard.intent-summary.expand', 'Expand dashboard intent')
              : t('dashboard.intent-summary.collapse', 'Collapse dashboard intent')
          }
          onClick={() => setCollapsed((v) => !v)}
          size="md"
        />
      </div>

      {!collapsed && (
        <div className={styles.body}>
          {showGetStarted && (
            <p className={styles.getStarted}>
              {t(
                'dashboard.intent-summary.get-started',
                'Add a purpose and owner so others understand what this dashboard is for.'
              )}
            </p>
          )}

          {isEditing ? (
            <PurposeInput dashboard={dashboard} value={purpose} />
          ) : (
            purpose && (
              <p className={styles.purpose}>
                {purpose}
                {intent?.provenance?.purpose && <ProvenanceMarker value={intent.provenance.purpose} />}
              </p>
            )
          )}

          {aggregated.failureModes.length > 0 && (
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              <span className={styles.label}>{t('dashboard.intent-summary.failure-modes', 'Failure modes:')}</span>
              {aggregated.failureModes.map((fm) => (
                <FailureModeChip
                  key={fm.tag}
                  tag={fm.tag}
                  description={fm.description}
                  panels={fm.panels}
                  active={matchedTags.has(fm.tag)}
                />
              ))}
            </Stack>
          )}

          {aggregated.runbooks.length > 0 && (
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              <Icon name="book" size="sm" aria-hidden />
              <span className={styles.label}>{t('dashboard.intent-summary.runbooks', 'Runbooks:')}</span>
              {aggregated.runbooks.map((rb) => (
                <a
                  key={rb.url || rb.title}
                  className={styles.runbookLink}
                  href={rb.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {rb.title}
                  <Icon name="external-link-alt" size="xs" className={styles.runbookIcon} aria-hidden />
                </a>
              ))}
            </Stack>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Re-renders the bar whenever any panel's intent changes, a panel is added or
 * removed, or the dashboard's own state changes. Panel intent lives on
 * per-panel `PanelIntentChips` scene objects, so a plain `dashboard.useState()`
 * would miss those edits; this hook subscribes to each panel and chip and
 * re-derives the aggregate.
 */
function useAggregatedPanelIntent(dashboard: DashboardScene): AggregatedPanelIntent {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  // Bumped when the set of panels changes so the per-panel/per-chip
  // subscriptions are torn down and re-established.
  const [topologyVersion, bumpTopology] = useReducer((n: number) => n + 1, 0);

  // Dashboard + layout-level subscriptions: catch panel add/remove and
  // dashboard-level intent edits.
  useEffect(() => {
    const subs: Unsubscribable[] = [];
    subs.push(dashboard.subscribeToState(() => forceUpdate()));
    subs.push(
      dashboard.state.body.subscribeToState(() => {
        bumpTopology();
        forceUpdate();
      })
    );
    return () => subs.forEach((s) => s.unsubscribe());
  }, [dashboard]);

  // Per-panel + per-chip subscriptions, re-established when the panel set
  // changes. A panel-state change (e.g. a chip created on first edit) bumps the
  // topology so the new chip gets a subscription.
  useEffect(() => {
    const subs: Unsubscribable[] = [];
    for (const panel of dashboardSceneGraph.getVizPanels(dashboard)) {
      subs.push(
        panel.subscribeToState((next, prev) => {
          if (next.titleItems !== prev.titleItems) {
            bumpTopology();
          }
          forceUpdate();
        })
      );
      const chip = dashboardSceneGraph.getPanelIntentChips(panel);
      if (chip) {
        subs.push(chip.subscribeToState(() => forceUpdate()));
      }
    }
    return () => subs.forEach((s) => s.unsubscribe());
  }, [dashboard, topologyVersion]);

  return dashboardSceneGraph.getAggregatedPanelIntent(dashboard);
}

function hasDashboardContent(intent: DashboardScene['state']['intent']): boolean {
  return Boolean(intent?.purpose || intent?.owner);
}

/** Reads the live dashboard intent, returning an empty object when absent. */
function currentIntent(dashboard: DashboardScene): DashboardIntent {
  return dashboard.state.intent ?? {};
}

/**
 * Commits a dashboard-level intent change through the edit-action system so it
 * participates in undo/redo and marks the dashboard dirty (`intent` is in
 * PERSISTED_PROPS).
 */
function commitIntent(dashboard: DashboardScene, prev: DashboardIntent, next: DashboardIntent, description: string) {
  dashboardEditActions.edit({
    description,
    source: dashboard,
    perform: () => dashboard.setState({ intent: next }),
    undo: () => dashboard.setState({ intent: prev }),
  });
}

function OwnerInput({ dashboard, value }: { dashboard: DashboardScene; value: string }) {
  const styles = useStyles2(getStyles);
  const before = useRef<DashboardIntent>(currentIntent(dashboard));

  return (
    <Input
      className={styles.ownerInput}
      value={value}
      placeholder={t('dashboard.intent-summary.owner-placeholder', '@team-handle')}
      onFocus={() => {
        before.current = currentIntent(dashboard);
      }}
      onChange={(e) => {
        const cur = currentIntent(dashboard);
        const owner = e.currentTarget.value || undefined;
        dashboard.setState({
          intent: {
            ...cur,
            owner,
            provenance: owner ? { ...cur.provenance, owner: 'author-written' } : cur.provenance,
          },
        });
      }}
      onBlur={() => {
        commitIntent(
          dashboard,
          before.current,
          currentIntent(dashboard),
          t('dashboard.intent-summary.edit-owner', 'Edit dashboard owner')
        );
      }}
    />
  );
}

function PurposeInput({ dashboard, value }: { dashboard: DashboardScene; value: string }) {
  const before = useRef<DashboardIntent>(currentIntent(dashboard));

  return (
    <TextArea
      value={value}
      rows={2}
      placeholder={t(
        'dashboard.intent-summary.purpose-placeholder',
        'Describe what this dashboard is for and what to watch for.'
      )}
      onFocus={() => {
        before.current = currentIntent(dashboard);
      }}
      onChange={(e) => {
        const cur = currentIntent(dashboard);
        const purpose = e.currentTarget.value || undefined;
        dashboard.setState({
          intent: {
            ...cur,
            purpose,
            provenance: purpose ? { ...cur.provenance, purpose: 'author-written' } : cur.provenance,
          },
        });
      }}
      onBlur={() => {
        commitIntent(
          dashboard,
          before.current,
          currentIntent(dashboard),
          t('dashboard.intent-summary.edit-purpose', 'Edit dashboard purpose')
        );
      }}
    />
  );
}

function OwnerChip({ owner, provenance }: { owner: string; provenance?: string }) {
  const styles = useStyles2(getChipStyles);
  const phrase = provenanceLabel(provenance);
  const chip = (
    <span className={styles.owner}>
      <Icon name="user" size="xs" aria-hidden /> {owner}
    </span>
  );
  // Only wrap in a tooltip when there is meaningful provenance to show.
  return phrase ? (
    <Tooltip content={t('dashboard.intent-summary.owner-provenance', 'owner — {{phrase}}', { phrase })} placement="top">
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

function FailureModeChip({
  tag,
  description,
  panels,
  active,
}: {
  tag: string;
  description?: string;
  panels: string[];
  active?: boolean;
}) {
  const styles = useStyles2(getChipStyles);
  const source = panels.length > 0 ? `From: ${panels.join(', ')}` : '';
  const base = [description, source].filter(Boolean).join(' — ');
  // Phase F-lite: when a panel that declares this failure mode is breaching its
  // alert threshold, the chip turns red and the tooltip leads with that fact.
  const content = active
    ? [t('dashboard.intent-summary.currently-matching', 'Currently matching'), base].filter(Boolean).join(' — ')
    : base || tag;
  return (
    <Tooltip content={content} placement="top">
      <span className={active ? styles.chipActive : styles.chip}>{tag}</span>
    </Tooltip>
  );
}

function ProvenanceMarker({ value }: { value: string }) {
  const styles = useStyles2(getChipStyles);
  const phrase = provenanceLabel(value);
  // Provenance is internal metadata; only surface it when it carries signal.
  if (!phrase) {
    return null;
  }
  return (
    <Tooltip content={phrase} placement="top">
      <span className={styles.provenanceMarker}>·</span>
    </Tooltip>
  );
}

// provenanceLabel turns the wire value into a short human-readable description
// that fits in a tooltip, or '' when there is no meaningful provenance to show.
function provenanceLabel(value: string | undefined): string {
  switch (value) {
    case 'author-written':
      return 'Written by the dashboard author';
    case 'assistant-confirmed':
      return 'Suggested by the assistant and confirmed by a human';
    case 'assistant-unconfirmed':
      return 'Draft suggestion from the assistant (not yet confirmed)';
    case 'lifted-from-alert':
      return 'Lifted verbatim from a linked alert rule';
    case 'lifted-from-slo':
      return 'Lifted from a linked SLO';
    case 'computed-from-history':
      return 'Computed from historical data';
    default:
      return '';
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.75, 1.5),
      marginBottom: theme.spacing(1),
    }),
    header: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    headerLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }),
    icon: css({
      color: theme.colors.text.secondary,
    }),
    body: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      paddingTop: theme.spacing(0.75),
    }),
    getStarted: css({
      margin: 0,
      fontSize: theme.typography.bodySmall.fontSize,
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
    }),
    purpose: css({
      margin: 0,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
      lineHeight: 1.4,
    }),
    ownerInput: css({
      maxWidth: 220,
    }),
    label: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    runbookLink: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      color: theme.colors.text.link,
      textDecoration: 'none',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    runbookIcon: css({
      opacity: 0.7,
    }),
  };
}

function getChipStyles(theme: GrafanaTheme2) {
  return {
    owner: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      padding: theme.spacing(0.125, 0.75),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.canvas,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
    }),
    chip: css({
      display: 'inline-block',
      padding: theme.spacing(0.125, 0.75),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
    }),
    chipActive: css({
      display: 'inline-block',
      padding: theme.spacing(0.125, 0.75),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.error.transparent,
      border: `1px solid ${theme.colors.error.border}`,
      color: theme.colors.error.text,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    provenanceMarker: css({
      marginLeft: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      cursor: 'help',
    }),
  };
}
