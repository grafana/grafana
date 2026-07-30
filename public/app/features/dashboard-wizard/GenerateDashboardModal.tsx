import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Modal, useStyles2 } from '@grafana/ui';

import { PromptStep } from './PromptStep';
import { getWizardDatasources, scopeDatasourcesToContext } from './context';
import { startPlanningInAssistant } from './handoff';
import { type WizardSeed } from './types';

interface Props {
  onDismiss: () => void;
  /** Entry points that already know the subject (datasource page, Explore) pre-seed the wizard. */
  seed?: WizardSeed;
}

/**
 * The "Generate dashboard" entry modal. The user describes the dashboard in
 * their own words — optionally attaching specific datasources, metrics,
 * labels, or dashboards through the assistant's context picker — and the
 * modal hands the request to the assistant sidebar: the user lands in the
 * new-dashboard editor, where the assistant plans the dashboard in the
 * conversation (grounding the plan in verified data, asking clarifying
 * questions in the chat, rendering the plan as a card with a "Build it"
 * button) and builds it in the same conversation once the plan is accepted.
 */
export function GenerateDashboardModal({ onDismiss, seed }: Props) {
  const styles = useStyles2(getStyles);

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
    // Runs exactly once, on open.
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
