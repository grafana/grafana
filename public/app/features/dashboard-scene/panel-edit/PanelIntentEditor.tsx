import { css } from '@emotion/css';
import { useEffect, useReducer } from 'react';

import { type OpenAssistantProps, createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { BusEventWithPayload, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';
import { Button, Field, IconButton, Input, Stack, TextArea, Tooltip, useStyles2 } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';
import { PanelIntentChips } from '../scene/PanelIntentChips';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

type PanelIntent = NonNullable<Panel['intent']>;
type FailureMode = NonNullable<PanelIntent['failureModes']>[number];
type RelatedSlo = NonNullable<PanelIntent['relatedSlos']>[number];
type Runbook = NonNullable<PanelIntent['runbooks']>[number];

// Payload published by the assistant plugin when it wants to fill the intent
// form fields without saving to the Grafana API. The event type string is shared
// with `fill_panel_intent_fields` tool in grafana-assistant-app.
interface PanelIntentFillPayload {
  dashboardUid: string;
  panelId: string;
  purpose?: string;
  owner?: string;
  expectedBehavior?: {
    normalRange?: string;
    alertThreshold?: string;
    notes?: string;
  };
  failureModes?: Array<{ tag: string; notes?: string }>;
  relatedSlos?: string[];
  runbooks?: string[];
  provenance?: Record<string, string>;
}

class PanelIntentFillEvent extends BusEventWithPayload<PanelIntentFillPayload> {
  static type = 'grafana-assistant:panel-intent-fill';
}

interface Props {
  panel: VizPanel;
}

/**
 * Edit-mode "Panel context" section.
 *
 * Reads/writes the panel's `intent` block via the `PanelIntentChips`
 * scene object that lives on `VizPanel.titleItems`. If the panel does
 * not yet have a chips object (because intent was never authored), one
 * is created on first edit so the chip and the persisted JSON appear
 * together.
 *
 * Provides a "Draft with AI" shortcut that opens the Grafana Assistant
 * with a prompt routing to the `suggest_dashboard_intent` tool, so the
 * user can pre-fill the section from the assistant's draft.
 *
 * Mounted inside the `Context` tab of the bottom data pane (alongside
 * Queries / Transformations / Alert), so the tab itself is the
 * container — this component renders the fields directly without an
 * additional collapse affordance.
 */
export function PanelIntentEditor({ panel }: Props) {
  // Subscribe to panel.titleItems so we re-render when the
  // PanelIntentChips title item is created on first edit (the chip is
  // injected lazily for panels that never had authored intent).
  panel.useState();
  const chips = dashboardSceneGraph.getPanelIntentChips(panel);
  // Render a stable child component regardless of whether the chip
  // exists — `IntentSubscriber` always sits at the same position in
  // the tree so React doesn't unmount/remount the editor (and lose
  // input focus) when the chip is created on first edit.
  return <IntentSubscriber panel={panel} chips={chips} />;
}

interface SubscriberProps {
  panel: VizPanel;
  chips: PanelIntentChips | null;
}

/**
 * Subscribes to the chip's state when one exists. We always call
 * `useSyncIntent` so React's hook order stays stable across renders
 * (even when the chip transitions from null → non-null).
 */
function IntentSubscriber({ panel, chips }: SubscriberProps) {
  const intent = useSyncIntent(chips);
  return <PanelIntentEditorBody panel={panel} intent={intent} />;
}

/**
 * Returns the current intent value, re-rendering the calling component
 * whenever the chip's intent state changes. Returns an empty intent
 * when no chip exists. Always calls the same hooks regardless of
 * whether `chips` is null so React's rules-of-hooks invariant is met.
 */
function useSyncIntent(chips: PanelIntentChips | null): PanelIntent {
  const [, setVersion] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!chips) {
      return;
    }
    const sub = chips.subscribeToState(() => setVersion());
    return () => sub.unsubscribe();
  }, [chips]);
  return chips?.state.intent ?? {};
}

interface BodyProps {
  panel: VizPanel;
  intent: PanelIntent;
}

function PanelIntentEditorBody({ panel, intent }: BodyProps) {
  const styles = useStyles2(getStyles);

  const currentIntent = (): PanelIntent =>
    dashboardSceneGraph.getPanelIntentChips(panel)?.state.intent ?? {};

  const writeIntent = (next: PanelIntent, description: string) => {
    const prev = currentIntent();
    dashboardEditActions.edit({
      description,
      source: panel,
      perform: () => upsertIntent(panel, next),
      undo: () => upsertIntent(panel, prev),
    });
  };

  // Subscribe to AI fill events so the assistant can populate fields
  // without saving to the Grafana API. The user reviews and saves normally.
  useEffect(() => {
    const dashboardUid = getDashboardSceneFor(panel).state.uid ?? '';
    const panelId = String(getPanelIdForVizPanel(panel));

    const sub = getAppEvents().subscribe(PanelIntentFillEvent, (event) => {
      const payload = event.payload;
      if (payload.dashboardUid !== dashboardUid || payload.panelId !== panelId) {
        return;
      }
      const cur = currentIntent();
      const next: PanelIntent = {
        ...cur,
        ...(payload.purpose !== undefined ? { purpose: payload.purpose || undefined } : {}),
        ...(payload.expectedBehavior !== undefined
          ? {
              expectedBehavior: {
                ...cur.expectedBehavior,
                ...(payload.expectedBehavior.normalRange !== undefined
                  ? { normalRange: payload.expectedBehavior.normalRange || undefined }
                  : {}),
                ...(payload.expectedBehavior.alertThreshold !== undefined
                  ? { alertThreshold: payload.expectedBehavior.alertThreshold || undefined }
                  : {}),
                ...(payload.expectedBehavior.notes !== undefined
                  ? { notes: payload.expectedBehavior.notes || undefined }
                  : {}),
              },
            }
          : {}),
        ...(payload.failureModes !== undefined
          ? {
              failureModes: payload.failureModes.map((fm) => ({
                tag: fm.tag,
                description: fm.notes,
              })),
            }
          : {}),
        ...(payload.relatedSlos !== undefined
          ? {
              relatedSlos: payload.relatedSlos.map((name) => ({ name })),
            }
          : {}),
        ...(payload.runbooks !== undefined
          ? {
              runbooks: payload.runbooks.map((url) => ({ title: url, url })),
            }
          : {}),
      };
      writeIntent(next, t('panel-intent-editor.fill-from-ai', 'Fill from AI'));
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  return (
    <div className={styles.formWrap}>
    <Stack direction="column" gap={1}>
      <DraftWithAIButton panel={panel} hasIntent={hasAnyIntent(intent)} />

      <Field
        noMargin
        label={
          <Stack direction="row" gap={0.5} alignItems="center">
            <span>{t('panel-intent-editor.purpose', 'Purpose')}</span>
            <SuggestFieldButton
              panel={panel}
              focus="purpose"
              tooltip={t('panel-intent-editor.suggest.purpose', 'Suggest a purpose statement with AI')}
            />
          </Stack>
        }
      >
        <TextArea
          value={intent.purpose ?? ''}
          rows={2}
          placeholder={t(
            'panel-intent-editor.purpose-placeholder',
            'One sentence: what does this panel measure and why does it matter?'
          )}
          onChange={(e) =>
            writeIntent(
              { ...currentIntent(), purpose: e.currentTarget.value || undefined },
              t('panel-intent-editor.edit.purpose', 'Edit panel purpose')
            )
          }
        />
      </Field>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          <Stack direction="row" gap={0.5} alignItems="center">
            {t('panel-intent-editor.expected', 'Expected behavior')}
            <SuggestFieldButton
              panel={panel}
              focus="expected behavior, alert threshold, normal range"
              tooltip={t('panel-intent-editor.suggest.expected', 'Suggest expected behavior with AI')}
            />
          </Stack>
        </legend>

        <Field noMargin label={t('panel-intent-editor.normal-range', 'Normal range')}>
          <Input
            value={intent.expectedBehavior?.normalRange ?? ''}
            placeholder={t('panel-intent-editor.normal-range-placeholder', 'p99 < 250ms')}
            onChange={(e) => {
              const cur = currentIntent();
              writeIntent(
                {
                  ...cur,
                  expectedBehavior: {
                    ...cur.expectedBehavior,
                    normalRange: e.currentTarget.value || undefined,
                  },
                },
                t('panel-intent-editor.edit.normal-range', 'Edit normal range')
              );
            }}
          />
        </Field>

        <Field noMargin label={t('panel-intent-editor.alert-threshold', 'Alert threshold')}>
          <Input
            value={intent.expectedBehavior?.alertThreshold ?? ''}
            placeholder={t('panel-intent-editor.alert-threshold-placeholder', 'p99 > 500ms for 5m')}
            onChange={(e) => {
              const cur = currentIntent();
              writeIntent(
                {
                  ...cur,
                  expectedBehavior: {
                    ...cur.expectedBehavior,
                    alertThreshold: e.currentTarget.value || undefined,
                  },
                },
                t('panel-intent-editor.edit.alert-threshold', 'Edit alert threshold')
              );
            }}
          />
        </Field>
      </fieldset>

      <FailureModesEditor
        failureModes={intent.failureModes ?? []}
        panel={panel}
        onChange={(failureModes) =>
          writeIntent(
            { ...currentIntent(), failureModes: failureModes.length ? failureModes : undefined },
            t('panel-intent-editor.edit.failure-modes', 'Edit failure modes')
          )
        }
      />

      <RelatedSlosEditor
        slos={intent.relatedSlos ?? []}
        onChange={(relatedSlos) =>
          writeIntent(
            { ...currentIntent(), relatedSlos: relatedSlos.length ? relatedSlos : undefined },
            t('panel-intent-editor.edit.related-slos', 'Edit related SLOs')
          )
        }
      />

      <RunbooksEditor
        runbooks={intent.runbooks ?? []}
        onChange={(runbooks) =>
          writeIntent(
            { ...currentIntent(), runbooks: runbooks.length ? runbooks : undefined },
            t('panel-intent-editor.edit.runbooks', 'Edit runbooks')
          )
        }
      />
    </Stack>
    </div>
  );
}

/**
 * Writes the next intent value into the panel's PanelIntentChips title
 * item, creating one if absent. When the next intent collapses to an
 * empty object we leave the chip in place but with an empty intent —
 * the chip renderer treats empty intent as "render nothing", and the
 * save path will still emit `panel.intent = {}`. Callers that want to
 * fully drop the block can call `removeIntent(panel)` instead.
 */
function upsertIntent(panel: VizPanel, intent: PanelIntent) {
  const existing = dashboardSceneGraph.getPanelIntentChips(panel);
  if (existing) {
    existing.setState({ intent });
    return;
  }
  const titleItems = panel.state.titleItems;
  const next = Array.isArray(titleItems) ? [...titleItems] : [];
  next.push(new PanelIntentChips({ intent }));
  panel.setState({ titleItems: next });
}

function hasAnyIntent(intent: PanelIntent): boolean {
  return Boolean(
    intent.purpose ||
      intent.expectedBehavior?.normalRange ||
      intent.expectedBehavior?.alertThreshold ||
      intent.failureModes?.length ||
      intent.relatedSlos?.length ||
      intent.runbooks?.length
  );
}

interface FailureModesEditorProps {
  failureModes: FailureMode[];
  onChange: (next: FailureMode[]) => void;
  panel: VizPanel;
}

function FailureModesEditor({ failureModes, onChange, panel }: FailureModesEditorProps) {
  const styles = useStyles2(getStyles);
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>
        <Stack direction="row" gap={0.5} alignItems="center">
          {t('panel-intent-editor.failure-modes', 'Failure modes')}
          <SuggestFieldButton
            panel={panel}
            focus="failure modes"
            tooltip={t('panel-intent-editor.suggest.failure-modes', 'Suggest failure modes with AI')}
          />
        </Stack>
      </legend>
      <Stack direction="column" gap={0.5}>
        {failureModes.map((fm, idx) => (
          <Stack key={idx} direction="row" gap={0.5} alignItems="center">
            <Input
              value={fm.tag}
              placeholder={t('panel-intent-editor.failure-modes.tag-placeholder', 'db-slow')}
              onChange={(e) => {
                const next = [...failureModes];
                next[idx] = { ...fm, tag: e.currentTarget.value };
                onChange(next);
              }}
            />
            <Input
              value={fm.description ?? ''}
              placeholder={t('panel-intent-editor.failure-modes.desc-placeholder', 'Description (optional)')}
              onChange={(e) => {
                const next = [...failureModes];
                next[idx] = { ...fm, description: e.currentTarget.value || undefined };
                onChange(next);
              }}
            />
            <IconButton
              name="trash-alt"
              tooltip={t('panel-intent-editor.failure-modes.remove', 'Remove failure mode')}
              onClick={() => onChange(failureModes.filter((_, i) => i !== idx))}
            />
          </Stack>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => onChange([...failureModes, { tag: '' }])}
        >
          {t('panel-intent-editor.failure-modes.add', 'Add failure mode')}
        </Button>
      </Stack>
    </fieldset>
  );
}

interface RelatedSlosEditorProps {
  slos: RelatedSlo[];
  onChange: (next: RelatedSlo[]) => void;
}

function RelatedSlosEditor({ slos, onChange }: RelatedSlosEditorProps) {
  const styles = useStyles2(getStyles);
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t('panel-intent-editor.related-slos', 'Related SLOs')}</legend>
      <Stack direction="column" gap={0.5}>
        {slos.map((slo, idx) => (
          <Stack key={idx} direction="row" gap={0.5} alignItems="center">
            <Input
              value={slo.name}
              placeholder={t('panel-intent-editor.related-slos.name-placeholder', 'SLO name')}
              onChange={(e) => {
                const next = [...slos];
                next[idx] = { ...slo, name: e.currentTarget.value };
                onChange(next);
              }}
            />
            <Input
              value={slo.target ?? ''}
              placeholder={t('panel-intent-editor.related-slos.target-placeholder', '99.9%')}
              onChange={(e) => {
                const next = [...slos];
                next[idx] = { ...slo, target: e.currentTarget.value || undefined };
                onChange(next);
              }}
            />
            <Input
              value={slo.url ?? ''}
              placeholder={t('panel-intent-editor.related-slos.url-placeholder', 'https://')}
              onChange={(e) => {
                const next = [...slos];
                next[idx] = { ...slo, url: e.currentTarget.value || undefined };
                onChange(next);
              }}
            />
            <IconButton
              name="trash-alt"
              tooltip={t('panel-intent-editor.related-slos.remove', 'Remove SLO')}
              onClick={() => onChange(slos.filter((_, i) => i !== idx))}
            />
          </Stack>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => onChange([...slos, { name: '' }])}
        >
          {t('panel-intent-editor.related-slos.add', 'Add SLO')}
        </Button>
      </Stack>
    </fieldset>
  );
}

interface RunbooksEditorProps {
  runbooks: Runbook[];
  onChange: (next: Runbook[]) => void;
}

function RunbooksEditor({ runbooks, onChange }: RunbooksEditorProps) {
  const styles = useStyles2(getStyles);
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t('panel-intent-editor.runbooks', 'Runbooks')}</legend>
      <Stack direction="column" gap={0.5}>
        {runbooks.map((rb, idx) => (
          <Stack key={idx} direction="row" gap={0.5} alignItems="center">
            <Input
              value={rb.title}
              placeholder={t('panel-intent-editor.runbooks.title-placeholder', 'Runbook title')}
              onChange={(e) => {
                const next = [...runbooks];
                next[idx] = { ...rb, title: e.currentTarget.value };
                onChange(next);
              }}
            />
            <Input
              value={rb.url ?? ''}
              placeholder={t('panel-intent-editor.runbooks.url-placeholder', 'https://')}
              onChange={(e) => {
                const next = [...runbooks];
                next[idx] = { ...rb, url: e.currentTarget.value };
                onChange(next);
              }}
            />
            <IconButton
              name="trash-alt"
              tooltip={t('panel-intent-editor.runbooks.remove', 'Remove runbook')}
              onClick={() => onChange(runbooks.filter((_, i) => i !== idx))}
            />
          </Stack>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => onChange([...runbooks, { title: '', url: '' }])}
        >
          {t('panel-intent-editor.runbooks.add', 'Add runbook')}
        </Button>
      </Stack>
    </fieldset>
  );
}

interface SuggestFieldButtonProps {
  panel: VizPanel;
  /** Natural-language focus hint forwarded to suggest_dashboard_intent as the `focus` param. */
  focus: string;
  /** Tooltip shown on the icon button. */
  tooltip: string;
}

/**
 * Phase E.3: small per-field "Suggest" icon button that opens the
 * Grafana Assistant pre-filled with a `suggest_dashboard_intent` prompt
 * scoped to a specific field. Less destructive than the top-level
 * "Draft with AI" button — the user can ask for one field at a time
 * without triggering a full intent draft.
 *
 * Renders nothing when the assistant is unavailable so authors on
 * non-assistant tenants don't see a non-functional shortcut.
 */
function SuggestFieldButton({ panel, focus, tooltip }: SuggestFieldButtonProps) {
  const assistant = useAssistant();
  if (!assistant.isAvailable || !assistant.openAssistant) {
    return null;
  }
  const { openAssistant } = assistant;
  const dashboard = getDashboardSceneFor(panel);
  const dashboardUid = dashboard.state.uid;
  const panelId = getPanelIdForVizPanel(panel);

  const handleClick = () => {
    reportInteraction('grafana_dashboard_intent_suggest_field_clicked', { focus });
    openAssistant({
      origin: 'grafana/dashboard/panel-context/suggest-field',
      mode: 'assistant',
      prompt: `For panel ${panelId} on dashboard ${dashboardUid}, use suggest_dashboard_intent with focus="${focus}" to draft just that field. Present the suggestion and wait for confirmation before saving.`,
      context: [
        createAssistantContextItem('structured', {
          title: `Panel ${panelId}`,
          data: { dashboardUid, panelId, focus },
        }),
      ],
      autoSend: true,
    });
  };

  return (
    <Tooltip content={tooltip} placement="top">
      <IconButton name="ai-sparkle" size="sm" aria-label={tooltip} onClick={handleClick} />
    </Tooltip>
  );
}

interface DraftWithAIButtonProps {
  panel: VizPanel;
  hasIntent: boolean;
}

/**
 * Opens the Grafana Assistant with a `suggest_dashboard_intent`-shaped
 * prompt for the current panel. The prompt names the tool explicitly so
 * the agent routes to it deterministically even when intent grounding
 * is disabled for the tenant.
 *
 * Renders nothing if the Assistant is unavailable in the current
 * Grafana install (e.g. the plugin is not enabled), so authors on
 * non-Assistant tenants don't see a non-functional shortcut.
 */
function DraftWithAIButton({ panel, hasIntent }: DraftWithAIButtonProps) {
  const assistant = useAssistant();
  if (!assistant.isAvailable || !assistant.openAssistant) {
    return null;
  }
  return (
    <DraftWithAIButtonView panel={panel} hasIntent={hasIntent} openAssistant={assistant.openAssistant} />
  );
}

function DraftWithAIButtonView({
  panel,
  hasIntent,
  openAssistant,
}: DraftWithAIButtonProps & { openAssistant: (props: OpenAssistantProps) => void }) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(panel);
  const dashboardUid = dashboard.state.uid;
  const panelId = getPanelIdForVizPanel(panel);

  const handleClick = () => {
    reportInteraction('grafana_dashboard_intent_draft_with_ai_clicked', {
      panel_has_existing_intent: hasIntent,
    });

    openAssistant({
      origin: 'grafana/dashboard/panel-context/draft-with-ai',
      mode: 'assistant',
      prompt: hasIntent
        ? `Refine the existing dashboard intent for panel ${panelId} on dashboard ${dashboardUid}. Call suggest_dashboard_intent to draft updates for stale or incomplete fields, then immediately call fill_panel_intent_fields with the result — do not ask for confirmation first. Do NOT call upsert_dashboard_intent; the user will save via "Save dashboard".`
        : `Draft dashboard intent for panel ${panelId} on dashboard ${dashboardUid}. Call suggest_dashboard_intent to generate the fields, then immediately call fill_panel_intent_fields with the result — do not ask for confirmation first. Do NOT call upsert_dashboard_intent; the user will save via "Save dashboard".`,
      context: [
        createAssistantContextItem('structured', {
          title: `Panel ${panelId}`,
          data: { dashboardUid, panelId },
        }),
      ],
      autoSend: true,
    });
  };

  return (
    <div className={styles.draftBar}>
      <Tooltip
        content={t(
          'panel-intent-editor.draft-with-ai.tooltip',
          'Open the Grafana Assistant prefilled with a suggest_dashboard_intent prompt for this panel.'
        )}
      >
        <Button variant="secondary" size="sm" icon="ai-sparkle" onClick={handleClick} className={styles.sparkleButton}>
          {hasIntent
            ? t('panel-intent-editor.draft-with-ai.refine', 'Suggest')
            : t('panel-intent-editor.draft-with-ai.draft', 'Write')}
        </Button>
      </Tooltip>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    group: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      margin: 0,
    }),
    legend: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      padding: theme.spacing(0, 0.5),
    }),
    draftBar: css({
      display: 'flex',
      justifyContent: 'flex-start',
    }),
    sparkleButton: css({
      '& svg': {
        color: theme.colors.warning.text,
      },
    }),
    formWrap: css({
      maxWidth: 600,
    }),
  };
}
