import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Modal, useStyles2 } from '@grafana/ui';

import { PromptStep } from './PromptStep';
import { getWizardDatasources, useWizardAssistant } from './api';
import { formatContextItemsForPrompt, scopeDatasourcesToContext } from './context';
import {
  cancelDashboardGenerationPrewarm,
  prewarmDashboardGeneration,
  startDashboardGeneration,
} from './generationState';
import { startPlanningInAssistant } from './handoff';
import { SHOWCASE_DISPLAY_PROMPT, SHOWCASE_INTENT, WIZARD_ORIGIN, buildGenerationPrompt } from './prompts';
import { supportsLabelLookups } from './tools';
import { type WizardSeed } from './types';

interface Props {
  onDismiss: () => void;
  /** Entry points that already know the subject (datasource page, Explore) pre-seed the wizard. */
  seed?: WizardSeed;
}

/** Labels the showcase build agent typically turns into template variables. */
const COMMON_VARIABLE_LABELS = ['job', 'namespace', 'cluster', 'instance'];

/** How many datasources the speculative label prefetch fans out to. */
const MAX_PREFETCH_DATASOURCES = 4;

/**
 * The "Generate dashboard" entry modal. The user describes the dashboard in
 * their own words — optionally attaching specific datasources, metrics,
 * labels, or dashboards through the assistant's context picker — and the
 * modal hands the request to the assistant sidebar: the user lands in the
 * new-dashboard editor, where the assistant plans the dashboard in the
 * conversation (grounding the plan in verified data, asking clarifying
 * questions in the chat, rendering the plan as a card with a "Build it"
 * button) and builds it in the same conversation once the plan is accepted.
 * Alternatively, "Just show me what Grafana can do" skips planning and runs a
 * headless showcase build (via DashboardGenerationHost) behind the dashboard
 * edit lock.
 */
export function GenerateDashboardModal({ onDismiss, seed }: Props) {
  const styles = useStyles2(getStyles);
  const { getFindings, prefetchLabelValues } = useWizardAssistant();

  const [freeText, setFreeText] = useState('');
  const [contextItems, setContextItems] = useState<ChatContextItem[]>([]);

  const allDatasources = useMemo(() => {
    const list = getWizardDatasources();
    const seedUids = new Set(seed?.datasourceUids ?? []);
    if (seedUids.size === 0) {
      return list;
    }
    const seeded = list.filter((ds) => seedUids.has(ds.uid));
    return seeded.length > 0 ? seeded : list;
  }, [seed]);

  // Datasources the user attached as context narrow the list further.
  const datasources = useMemo(
    () => scopeDatasourcesToContext(allDatasources, contextItems),
    [allDatasources, contextItems]
  );

  useEffect(() => {
    reportInteraction('dashboard_wizard_opened');
    // The showcase path still builds headlessly, so let the host mount the
    // assistant's builder in prewarm mode: the chat session that build needs
    // is then already created when generation starts. Also warm the label
    // values that build folds into its prompt as verified findings.
    prewarmDashboardGeneration(WIZARD_ORIGIN);
    prefetchLabelValues(
      allDatasources.filter(supportsLabelLookups).slice(0, MAX_PREFETCH_DATASOURCES),
      COMMON_VARIABLE_LABELS
    );
    return () => {
      // Release the prewarmed assistant session if the user backed out
      // without building (no-op once a generation has started).
      cancelDashboardGenerationPrewarm();
    };
    // Runs exactly once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddContextItem = (item: ChatContextItem) => {
    setContextItems((prev) => (prev.some((existing) => existing.node.id === item.node.id) ? prev : [...prev, item]));
  };

  const handleRemoveContextItem = (item: ChatContextItem) => {
    setContextItems((prev) => prev.filter((existing) => existing.node.id !== item.node.id));
  };

  /** The user's free text plus any entry-point hint, as sent to the assistant. */
  const composeRequest = () => {
    const written = freeText.trim();
    return seed?.promptHint ? `${written}\n\nWhere this request came from:\n${seed.promptHint}` : written;
  };

  /**
   * Hands the prompt to the assistant sidebar for planning: the user lands in
   * the new-dashboard editor and the conversation takes it from there.
   */
  const handleSubmitPrompt = () => {
    if (freeText.trim() === '') {
      return;
    }

    reportInteraction('dashboard_wizard_planning_started', { contextItems: contextItems.length });

    startPlanningInAssistant({
      request: composeRequest(),
      displayPrompt: freeText.trim(),
      contextItems,
      datasources,
    });

    onDismiss();
  };

  /**
   * The showcase path has no user intent to plan around, so it builds
   * directly and headlessly: publish the request for the app-level
   * DashboardGenerationHost, which runs the assistant's dashboarding agent
   * against the live scene behind the dashboard edit lock, with the build's
   * conversation streaming in the assistant sidebar.
   */
  const handleShowMeWhatGrafanaCanDo = () => {
    reportInteraction('dashboard_wizard_generated', { contextItems: contextItems.length });

    const contextNotes = formatContextItemsForPrompt(contextItems);

    startDashboardGeneration({
      origin: WIZARD_ORIGIN,
      target: 'new',
      prompt: buildGenerationPrompt({
        intent: SHOWCASE_INTENT,
        clarifications: [],
        datasources,
        findings: getFindings(),
        contextNotes: contextNotes || undefined,
      }),
      displayPrompt: SHOWCASE_DISPLAY_PROMPT,
    });

    // Land in the new-dashboard editor right away so the user watches the
    // build from the start.
    locationService.push('/dashboard/new');

    onDismiss();
  };

  return (
    <Modal
      title={t('dashboard-wizard.modal.title', "Let's build a dashboard")}
      isOpen={true}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <PromptStep
        freeText={freeText}
        onFreeTextChange={setFreeText}
        contextItems={contextItems}
        onAddContextItem={handleAddContextItem}
        onRemoveContextItem={handleRemoveContextItem}
        onSubmit={handleSubmitPrompt}
        onShowMeWhatGrafanaCanDo={handleShowMeWhatGrafanaCanDo}
        busy={false}
      />
    </Modal>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.md,
    }),
  };
}
