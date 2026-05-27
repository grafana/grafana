import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type Panel } from '@grafana/schema';
import { type SceneComponentProps, type SceneObjectState, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface PanelIntentChipsState extends SceneObjectState {
  intent: NonNullable<Panel['intent']>;
}

/**
 * Renders a row of compact chips in a panel's title area summarizing
 * the panel's `intent` block — currently expected behavior (normal
 * range, alert threshold) and the highest-priority failure mode tag.
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
  };
}

export function PanelIntentChipsRenderer({ model }: SceneComponentProps<PanelIntentChips>) {
  const { intent } = model.useState();
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
          content={`Normal range — ${provenanceTooltip(expectedProvenance)}`}
          placement="top"
        >
          <span className={chipClass(styles, expectedProvenance)}>~ {expected.normalRange}</span>
        </Tooltip>
      )}
      {expected?.alertThreshold && (
        <Tooltip
          content={`Alert threshold — ${provenanceTooltip(thresholdProvenance)}`}
          placement="top"
        >
          <span className={chipClass(styles, thresholdProvenance)}>
            <Icon name="bell" size="xs" aria-hidden /> {expected.alertThreshold}
          </span>
        </Tooltip>
      )}
      {primaryFailureMode && (
        <Tooltip
          content={failureModeTooltip(primaryFailureMode, extraFailureModes, failureModesProvenance)}
          placement="top"
        >
          {/*
           * Phase E.4: a declared failure mode is a pattern the
           * author wants the team to watch for — not an active
           * incident. Render it as a quiet tag (no warning icon, `#`
           * prefix to read as a label) so it does not visually
           * collide with the runtime panel-error chip (which uses
           * `exclamation-triangle` + destructive red). The red +
           * warning treatment is reserved for the active-match state
           * tracked by Phase F.
           */}
          <span className={failureModeChipClass(styles, failureModesProvenance)}>
            #{primaryFailureMode.tag}
            {extraFailureModes > 0 ? ` +${extraFailureModes}` : ''}
          </span>
        </Tooltip>
      )}
    </div>
  );
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

function provenanceTooltip(value: string | undefined): string {
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
      return 'no provenance recorded';
  }
}

function failureModeTooltip(
  primary: NonNullable<Panel['intent']>['failureModes'] extends Array<infer T> | undefined ? T : never,
  extra: number,
  provenance: string | undefined
): string {
  const tail = primary.description ? `${primary.tag}: ${primary.description}` : primary.tag;
  const more = extra > 0 ? ` (+ ${extra} more)` : '';
  return `${tail}${more} — ${provenanceTooltip(provenance)}`;
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
  return {
    row: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      paddingLeft: theme.spacing(0.5),
      marginLeft: 'auto',
    }),
    chip: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }),
    chipDraft: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.secondary,
      border: `1px dashed ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }),
  };
}
