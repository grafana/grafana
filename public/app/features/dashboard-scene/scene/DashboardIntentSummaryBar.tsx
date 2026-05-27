import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { type DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

/**
 * A compact, always-on summary of the dashboard-level `intent` block.
 *
 * Renders nothing when the dashboard has no intent — this is the
 * dominant case today, so the cost of mounting the component must
 * round to zero.
 *
 * Visible information is deliberately limited to the things an SRE
 * scanning a dashboard cold needs in the first three seconds:
 * purpose, owner, failure modes, and runbook shortcuts. The full
 * structured intent (expected behavior, related SLOs, per-field
 * provenance) lives in the edit-mode panel context section (C3); a
 * summary bar that tried to surface all of it would defeat its own
 * purpose.
 */
export function DashboardIntentSummaryBar({ dashboard }: Props) {
  const { intent } = dashboard.useState();
  const styles = useStyles2(getStyles);

  // Default to expanded; user can collapse with the chevron. A
  // "collapse by default on dense dashboards" heuristic would need a
  // reliable panel count from the scene model, which the layouts
  // refactor abstracts away — revisit when there's a stable accessor.
  const [collapsed, setCollapsed] = useState(false);

  if (!intent || !hasAnyContent(intent)) {
    return null;
  }

  // Defensively coerce list fields. The intent block is authored
  // free-form (legacy hand-edits, LLM drafts, cross-version imports)
  // and we have observed `failureModes` and `runbooks` arriving as
  // bare strings or missing entirely. Render nothing rather than
  // crash the dashboard when a list-shaped field isn't actually a
  // list.
  const { purpose, owner } = intent;
  const failureModes = Array.isArray(intent.failureModes) ? intent.failureModes : [];
  const runbooks = Array.isArray(intent.runbooks) ? intent.runbooks : [];

  return (
    <div className={styles.wrapper} data-testid="dashboard-intent-summary-bar">
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name="info-circle" className={styles.icon} aria-hidden />
          <span className={styles.headerLabel}>About this dashboard</span>
          {owner && <OwnerChip owner={owner} provenance={intent.provenance?.owner} />}
        </Stack>
        <IconButton
          name={collapsed ? 'angle-down' : 'angle-up'}
          aria-label={collapsed ? 'Expand dashboard intent' : 'Collapse dashboard intent'}
          onClick={() => setCollapsed((v) => !v)}
          size="md"
        />
      </div>

      {!collapsed && (
        <div className={styles.body}>
          {purpose && (
            <p className={styles.purpose}>
              {purpose}
              {intent.provenance?.purpose && <ProvenanceMarker value={intent.provenance.purpose} />}
            </p>
          )}

          {failureModes.length > 0 && (
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              <span className={styles.label}>Failure modes:</span>
              {failureModes.map((fm) => (
                <FailureModeChip
                  key={fm.tag}
                  tag={fm.tag}
                  description={fm.description}
                  provenance={intent.provenance?.failure_modes}
                />
              ))}
            </Stack>
          )}

          {runbooks.length > 0 && (
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              <Icon name="book" size="sm" aria-hidden />
              <span className={styles.label}>Runbooks:</span>
              {runbooks.map((rb) => (
                <a key={rb.url || rb.title} className={styles.runbookLink} href={rb.url} target="_blank" rel="noopener noreferrer">
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

function hasAnyContent(intent: NonNullable<DashboardScene['state']['intent']>): boolean {
  return Boolean(
    intent.purpose ||
      intent.owner ||
      (intent.failureModes && intent.failureModes.length > 0) ||
      (intent.runbooks && intent.runbooks.length > 0) ||
      intent.expectedBehavior?.notes
  );
}

function OwnerChip({ owner, provenance }: { owner: string; provenance?: string }) {
  const styles = useStyles2(getChipStyles);
  return (
    <Tooltip content={provenanceTooltip('owner', provenance)} placement="top">
      <span className={styles.owner}>
        <Icon name="user" size="xs" aria-hidden /> {owner}
      </span>
    </Tooltip>
  );
}

function FailureModeChip({ tag, description, provenance }: { tag: string; description?: string; provenance?: string }) {
  const styles = useStyles2(getChipStyles);
  const isDraft = provenance === 'assistant-unconfirmed';
  return (
    <Tooltip content={description ? `${description} (${provenanceLabel(provenance)})` : provenanceLabel(provenance)} placement="top">
      <span className={isDraft ? styles.chipDraft : styles.chip}>{tag}</span>
    </Tooltip>
  );
}

function ProvenanceMarker({ value }: { value: string }) {
  const styles = useStyles2(getChipStyles);
  return (
    <Tooltip content={provenanceLabel(value)} placement="top">
      <span className={styles.provenanceMarker}>·</span>
    </Tooltip>
  );
}

// provenanceLabel turns the wire value into a short human-readable
// description that fits in a tooltip. Kept tiny on purpose — anything
// more detailed belongs in the edit-mode section, not in a hover state.
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
      return 'No provenance recorded';
  }
}

function provenanceTooltip(field: string, value: string | undefined): string {
  return `${field}: ${provenanceLabel(value)}`;
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
    purpose: css({
      margin: 0,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
      lineHeight: 1.4,
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
    chipDraft: css({
      display: 'inline-block',
      padding: theme.spacing(0.125, 0.75),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.canvas,
      border: `1px dashed ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
    }),
    provenanceMarker: css({
      marginLeft: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      cursor: 'help',
    }),
  };
}
