import { css } from '@emotion/css';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { FieldType, dateTimeFormat, type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type SceneComponentProps, type SceneObjectState, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';
import { Button, Icon, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { isLessThanThreshold, parseAlertThreshold, parseNormalRange } from './parseIntentThresholds';

/** Severity state for an individual chip derived from live panel data. */
type ChipState = 'alerting' | 'warning' | 'normal';

/** Per-chip states computed independently from live panel data. */
interface ChipStates {
  /** State of the normalRange chip: normal if value is within band, warning if outside. */
  range?: ChipState;
  /** State of the alertThreshold chip: alerting if breached, normal if below. */
  alert?: ChipState;
}

/**
 * An active match between live panel data and the panel's declared failure
 * modes (Phase F-lite). Present only while the panel is breaching its alert
 * threshold — at which point the breach is attributed to the declared failure
 * modes so the author sees "this is the pattern we warned about, happening now".
 */
export interface ActiveMatch {
  /** Epoch ms when the breach was first detected this session. */
  since: number;
}

interface PanelIntentChipsState extends SceneObjectState {
  intent: NonNullable<Panel['intent']>;
  /**
   * Per-chip threshold states computed from live panel data.
   * undefined while data hasn't loaded yet or thresholds can't be parsed.
   */
  chipStates?: ChipStates;
  /**
   * Set while the panel is actively breaching its alert threshold and has
   * declared failure modes to attribute the breach to. undefined otherwise.
   */
  activeMatch?: ActiveMatch;
}

/**
 * Renders a row of compact chips in a panel's title area summarizing
 * the panel's `intent` block — currently expected behavior (normal
 * range, alert threshold) and the highest-priority failure mode tag.
 *
 * Phase E.5: each chip is colored according to the live panel data
 * compared against the intent thresholds, giving a glanceable health
 * status without interfering with the panel's own fieldConfig.
 *
 * The chips are intentionally low-signal: the goal is to put a 2-second
 * "what should this panel show?" anchor next to the title without
 * cluttering the header. Full intent (notes, related SLOs, owner)
 * lives in the panel edit-mode context section (C3).
 */
export class PanelIntentChips extends SceneObjectBase<PanelIntentChipsState> {
  static Component = PanelIntentChipsRenderer;

  constructor(state: PanelIntentChipsState) {
    super(state);
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    if (!this.parent || !(this.parent instanceof VizPanel)) {
      throw new Error('PanelIntentChips must be used as a VizPanel title item');
    }

    const recompute = () => {
      const dataState = sceneGraph.getData(this).state;
      const chipStates = computeChipStates(this.state.intent, dataState.data?.series ?? []);
      const failureModes = Array.isArray(this.state.intent.failureModes) ? this.state.intent.failureModes : [];
      const activeMatch = computeActiveMatch(chipStates, failureModes, this.state.activeMatch, Date.now());
      this.setState({ chipStates, activeMatch });
    };

    // Evaluate immediately with whatever data is already loaded.
    recompute();

    // Re-evaluate whenever panel data refreshes.
    const dataSub = sceneGraph.getData(this).subscribeToState(recompute);

    // Re-evaluate when intent is edited at runtime (e.g. via PanelIntentEditor).
    const intentSub = this.subscribeToState((next, prev) => {
      if (next.intent !== prev.intent) {
        recompute();
      }
    });

    return () => {
      dataSub.unsubscribe();
      intentSub.unsubscribe();
    };
  };
}

// ---------------------------------------------------------------------------
// Threshold state computation (Phase E.5)
// ---------------------------------------------------------------------------

/**
 * Compute independent chip states for the normalRange and alertThreshold
 * chips from live panel data.
 *
 * Each chip reflects only its own condition so they can diverge:
 * e.g. value within the normal band (range=normal) but still below the
 * alert threshold (alert=normal), or outside the band (range=warning)
 * but not yet past the alert line (alert=normal).
 */
export function computeChipStates(
  intent: NonNullable<Panel['intent']>,
  series: DataFrame[]
): ChipStates | undefined {
  const alertThresholdValue = parseAlertThreshold(intent.expectedBehavior?.alertThreshold);
  const normalRange = parseNormalRange(intent.expectedBehavior?.normalRange);

  if (alertThresholdValue === undefined && normalRange === undefined) {
    return undefined;
  }

  const isLess = isLessThanThreshold(intent.expectedBehavior?.alertThreshold);
  // For > thresholds: worst = max; for < thresholds: worst = min.
  const worstValue = getWorstLastValue(series, isLess);
  if (worstValue === undefined) {
    return undefined;
  }

  const result: ChipStates = {};

  if (alertThresholdValue !== undefined) {
    const breached = isLess ? worstValue < alertThresholdValue : worstValue > alertThresholdValue;
    result.alert = breached ? 'alerting' : 'normal';
  }

  if (normalRange) {
    const withinRange = worstValue >= normalRange.min && worstValue <= normalRange.max;
    result.range = withinRange ? 'normal' : 'warning';
  }

  return result;
}

/**
 * Decide whether the panel is actively matching a declared failure mode
 * (Phase F-lite). For now the trigger is deterministic: the panel is breaching
 * its alert threshold (`chipStates.alert === 'alerting'`) AND it declares at
 * least one failure mode to attribute the breach to. The match-start time is
 * preserved across recomputes so the popover can show "since HH:MM"; it resets
 * once the panel returns below the threshold.
 *
 * Step 2 (deferred) will let each failure mode carry its own condition so the
 * match can name the specific mode rather than attributing to all declared ones.
 */
export function computeActiveMatch(
  chipStates: ChipStates | undefined,
  failureModes: Array<{ tag: string }>,
  prev: ActiveMatch | undefined,
  now: number
): ActiveMatch | undefined {
  const breaching = chipStates?.alert === 'alerting';
  if (breaching && failureModes.length > 0) {
    return prev ?? { since: now };
  }
  return undefined;
}

/**
 * Return the last value (per series) that represents the worst-case
 * relative to the threshold direction.
 *
 * For > thresholds: highest last value across all numeric fields.
 * For < thresholds: lowest last value across all numeric fields.
 */
function getWorstLastValue(series: DataFrame[], isLess: boolean): number | undefined {
  let worst: number | undefined = undefined;
  for (const frame of series) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      const len = field.values.length;
      if (!len) {
        continue;
      }
      const last = (field.values as number[])[len - 1];
      if (typeof last !== 'number' || !Number.isFinite(last)) {
        continue;
      }
      if (worst === undefined) {
        worst = last;
      } else {
        worst = isLess ? Math.min(worst, last) : Math.max(worst, last);
      }
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function PanelIntentChipsRenderer({ model }: SceneComponentProps<PanelIntentChips>) {
  const { intent, chipStates, activeMatch } = model.useState();
  const styles = useStyles2(getStyles);

  // Defensive shape coercion: the intent block is authored
  // free-form (legacy hand-edits, LLM drafts, cross-version imports)
  // and we have observed `failureModes` arriving as a bare string and
  // `expectedBehavior` arriving as a string instead of an object.
  // Bail to "no chip-worthy content" for malformed shapes rather than
  // crashing the panel header.
  const expected =
    intent.expectedBehavior && typeof intent.expectedBehavior === 'object' ? intent.expectedBehavior : undefined;
  const failureModes = Array.isArray(intent.failureModes) ? intent.failureModes : [];
  const expectedProvenance = intent.provenance?.['expected_behavior.normal_range'];
  const thresholdProvenance = intent.provenance?.['expected_behavior.alert_threshold'];
  const failureModesProvenance = intent.provenance?.failure_modes;

  // Show at most the top failure mode in the header to keep the row
  // compact. The remaining ones are revealed via the tooltip when the
  // user hovers the chip, and visible in full in the edit-mode section.
  const primaryFailureMode = failureModes[0];
  const extraFailureModes = failureModes.length - 1;

  // Bail out cleanly if the intent block exists but has nothing the
  // chips would surface (purpose-only intent is rendered in the dashboard
  // summary bar, not at the panel-header level).
  if (!expected?.normalRange && !expected?.alertThreshold && !primaryFailureMode) {
    return null;
  }

  return (
    <div className={styles.row} data-testid="panel-intent-chips">
      {expected?.normalRange && (
        <Tooltip
          content={withProvenance('Normal range', expectedProvenance)}
          placement="top"
        >
          <span className={resolvedChipClass(styles, chipStates?.range, expectedProvenance)}>
            ~ {expected.normalRange}
          </span>
        </Tooltip>
      )}
      {expected?.alertThreshold && (
        <Tooltip
          content={withProvenance('Alert threshold', thresholdProvenance)}
          placement="top"
        >
          <span className={resolvedChipClass(styles, chipStates?.alert, thresholdProvenance)}>
            <Icon name="bell" size="xs" aria-hidden /> {expected.alertThreshold}
          </span>
        </Tooltip>
      )}
      {primaryFailureMode &&
        (activeMatch ? (
          // Phase F-lite: the panel is breaching its alert threshold, which
          // matches the declared failure mode(s) — surface it as an active,
          // red chip with an interactive popover (distinct `bolt` icon so it
          // doesn't read as the runtime panel-error chip's exclamation-triangle).
          <ActiveMatchChip
            model={model}
            failureModes={failureModes}
            since={activeMatch.since}
            styles={styles}
          />
        ) : (
          <Tooltip content={failureModeTooltip(failureModes, failureModesProvenance)} placement="top">
            {/*
             * Phase E.4: a declared failure mode is a pattern the author
             * wants the team to watch for — not an active incident. Render
             * it as a quiet tag (no warning icon, `#` prefix to read as a
             * label) so it does not visually collide with the runtime
             * panel-error chip. The red active-match treatment lives in
             * ActiveMatchChip above.
             */}
            <span className={failureModeChipClass(styles, failureModesProvenance)}>
              #{primaryFailureMode.tag}
              {extraFailureModes > 0 ? ` +${extraFailureModes}` : ''}
            </span>
          </Tooltip>
        ))}
    </div>
  );
}

interface ActiveMatchChipProps {
  model: PanelIntentChips;
  failureModes: NonNullable<NonNullable<Panel['intent']>['failureModes']>;
  since: number;
  styles: ReturnType<typeof getStyles>;
}

/**
 * The red, interactive chip shown while a panel is actively breaching its
 * alert threshold (Phase F-lite). Lists the matched failure mode(s), shows
 * since when, and — if the assistant is available — offers an "Investigate"
 * shortcut that opens the Grafana Assistant to reason about the live data
 * against the declared intent (the on-demand LLM layer).
 */
function ActiveMatchChip({ model, failureModes, since, styles }: ActiveMatchChipProps) {
  const assistant = useAssistant();
  const primary = failureModes[0];
  const extra = failureModes.length - 1;
  const tags = failureModes.map((fm) => `#${fm.tag}`).join(', ');
  const sinceLabel = dateTimeFormat(since, { format: 'HH:mm' });

  const handleInvestigate = () => {
    const panel = model.parent instanceof VizPanel ? model.parent : undefined;
    if (!panel || !assistant.openAssistant) {
      return;
    }
    const dashboardUid = getDashboardSceneFor(panel).state.uid;
    const panelId = getPanelIdForVizPanel(panel);
    assistant.openAssistant({
      origin: 'grafana/dashboard/panel-intent/investigate-match',
      mode: 'assistant',
      prompt: `Panel ${panelId} on dashboard ${dashboardUid} is currently breaching its alert threshold, which matches the declared failure mode(s) ${tags}. Investigate the likely cause using the panel's queries and the dashboard intent, then summarize what is happening and what to check next.`,
      context: [
        createAssistantContextItem('structured', {
          title: `Panel ${panelId}`,
          data: { dashboardUid, panelId, matchedFailureModes: tags, breachingSince: sinceLabel },
        }),
      ],
      autoSend: true,
    });
  };

  const popover = (
    <Stack direction="column" gap={0.5}>
      <span className={styles.matchTitle}>{t('panel-intent-chips.match-title', 'Matches {{tags}}', { tags })}</span>
      <span className={styles.matchDetail}>
        {t('panel-intent-chips.match-detail', 'Alert threshold breached since {{since}}', { since: sinceLabel })}
      </span>
      {assistant.isAvailable && assistant.openAssistant && (
        <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={handleInvestigate}>
          {t('panel-intent-chips.investigate', 'Investigate')}
        </Button>
      )}
    </Stack>
  );

  return (
    <Tooltip content={popover} placement="top" interactive>
      <span className={styles.chipMatch} data-testid="panel-intent-active-match">
        <Icon name="bolt" size="xs" aria-hidden /> #{primary.tag}
        {extra > 0 ? ` +${extra}` : ''}
      </span>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Chip class helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the chip CSS class for threshold-aware chips (normalRange,
 * alertThreshold). When a threshold state is known it takes precedence
 * over the provenance style so the health signal is always visible.
 */
function resolvedChipClass(
  styles: ReturnType<typeof getStyles>,
  state: ChipState | undefined,
  provenance: string | undefined
): string {
  if (state === 'alerting') {
    return styles.chipAlerting;
  }
  if (state === 'warning') {
    return styles.chipWarning;
  }
  if (state === 'normal') {
    return styles.chipNormal;
  }
  return chipClass(styles, provenance);
}

function chipClass(styles: ReturnType<typeof getStyles>, provenance: string | undefined): string {
  return provenance === 'assistant-unconfirmed' ? styles.chipDraft : styles.chip;
}

/**
 * Failure-mode chips share the same provenance-based style switch as
 * the other chips but route through their own class so the visual
 * disambiguation from the runtime panel-error chip (Phase E.4) stays
 * declarative and easy to tweak in one place. Today they reuse the
 * generic chip styles; reserved as a hook for future per-state
 * styling (active-match red, Phase F).
 */
function failureModeChipClass(
  styles: ReturnType<typeof getStyles>,
  provenance: string | undefined
): string {
  return provenance === 'assistant-unconfirmed' ? styles.chipDraft : styles.chip;
}

// provenanceLabel maps a provenance value to a short human-readable phrase, or
// returns '' when there is no meaningful provenance to show. Provenance is
// internal metadata (who authored a field), so we only surface it when it adds
// signal — never as a noisy "no provenance recorded" line.
function provenanceLabel(value: string | undefined): string {
  switch (value) {
    case 'author-written':
      return 'written by the dashboard author';
    case 'assistant-confirmed':
      return 'suggested by the assistant and confirmed';
    case 'assistant-unconfirmed':
      return 'draft suggestion (not yet confirmed)';
    case 'lifted-from-alert':
      return 'lifted from a linked alert rule';
    case 'lifted-from-slo':
      return 'lifted from a linked SLO';
    case 'computed-from-history':
      return 'computed from history';
    default:
      return '';
  }
}

// withProvenance appends the provenance phrase to a label only when there is
// one, so tooltips read "Normal range — draft suggestion" or just "Normal range".
function withProvenance(label: string, value: string | undefined): string {
  const phrase = provenanceLabel(value);
  return phrase ? `${label} — ${phrase}` : label;
}

function failureModeTooltip(
  failureModes: NonNullable<NonNullable<Panel['intent']>['failureModes']>,
  provenance: string | undefined
): string {
  // List every declared failure mode tag (the header chip only shows the
  // first + a "+N" counter). Tags only — descriptions are surfaced in the
  // Context editor, not here, so the tooltip stays a quick scannable list.
  const tags = failureModes.map((fm) => `#${fm.tag}`).join(', ');
  const phrase = provenanceLabel(provenance);
  return phrase ? `${tags} — ${phrase}` : tags;
}

function getStyles(theme: GrafanaTheme2) {
  // Note: panel header chips share the look-and-feel of the summary bar
  // chips but use a slightly smaller padding so they fit the panel
  // header height without bumping it.
  //
  // Phase E.4: intent chips render as `titleItems` on the VizPanel,
  // which already places them to the right of the title text — but
  // the row container also flexes with `marginLeft: auto` so any
  // sibling title items don't squeeze the chips into the title's
  // visual zone. This keeps the left edge of the header reserved for
  // the runtime panel-error chip (red `exclamation-triangle`) and
  // pushes declared-failure-mode chips firmly to the right.
  const chipBase = {
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: theme.spacing(0.25),
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.4,
    whiteSpace: 'nowrap' as const,
    cursor: 'default',
  };

  return {
    row: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      paddingLeft: theme.spacing(0.5),
      marginLeft: 'auto',
    }),
    chip: css({
      ...chipBase,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
    }),
    chipDraft: css({
      ...chipBase,
      backgroundColor: theme.colors.background.secondary,
      border: `1px dashed ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    // Phase E.5: live-data state variants
    chipNormal: css({
      ...chipBase,
      backgroundColor: theme.colors.success.transparent,
      border: `1px solid ${theme.colors.success.border}`,
      color: theme.colors.success.text,
    }),
    chipWarning: css({
      ...chipBase,
      backgroundColor: theme.colors.warning.transparent,
      border: `1px solid ${theme.colors.warning.border}`,
      color: theme.colors.warning.text,
    }),
    chipAlerting: css({
      ...chipBase,
      backgroundColor: theme.colors.error.transparent,
      border: `1px solid ${theme.colors.error.border}`,
      color: theme.colors.error.text,
    }),
    // Phase F-lite: active failure-mode match. Stronger than chipAlerting
    // (solid error fill + medium weight) so the "this is firing now" chip
    // stands out from the threshold chips and reads as a live signal.
    chipMatch: css({
      ...chipBase,
      backgroundColor: theme.colors.error.main,
      border: `1px solid ${theme.colors.error.border}`,
      color: theme.colors.error.contrastText,
      fontWeight: theme.typography.fontWeightMedium,
      cursor: 'pointer',
    }),
    matchTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    matchDetail: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
