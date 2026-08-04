import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Modal, useStyles2 } from '@grafana/ui';

import { DashboardPrompt } from './DashboardPrompt';
import { getPromptDatasources } from './datasources';
import { startPlanningInAssistant } from './handoff';
import { type PromptSeed } from './types';

interface Props {
  onDismiss: () => void;
  /** Entry points that already know the subject (datasource page, Explore) pre-seed the prompt. */
  seed?: PromptSeed;
}

/**
 * The "Generate dashboard" entry modal. The user describes the dashboard in
 * their own words and the modal hands the request to the assistant sidebar:
 * the user lands in the new-dashboard editor, where the assistant plans the
 * dashboard in the conversation (grounding the plan in verified data, asking
 * clarifying questions in the chat, rendering the plan as a card with a
 * "Build it" button) and builds it in the same conversation once the plan is
 * accepted.
 */
export function GenerateDashboardModal({ onDismiss, seed }: Props) {
  const styles = useStyles2(getStyles);

  const datasources = useMemo(() => {
    const list = getPromptDatasources();
    const seedUids = new Set(seed?.datasourceUids ?? []);
    if (seedUids.size === 0) {
      return list;
    }
    const seeded = list.filter((ds) => seedUids.has(ds.uid));
    return seeded.length > 0 ? seeded : list;
  }, [seed]);

  useEffect(() => {
    reportInteraction('dashboard_prompt_opened');
    // Runs exactly once, on open.
  }, []);

  /** The user's prompt plus any entry-point hint, as sent to the assistant. */
  const composeRequest = (prompt: string) =>
    seed?.promptHint ? `${prompt}\n\nWhere this request came from:\n${seed.promptHint}` : prompt;

  /**
   * Hands the prompt to the assistant sidebar for planning: the user lands in
   * the new-dashboard editor and the conversation takes it from there.
   */
  const handleSubmitPrompt = (prompt: string) => {
    reportInteraction('dashboard_prompt_planning_started');

    startPlanningInAssistant({
      request: composeRequest(prompt),
      displayPrompt: prompt,
      datasources,
    });

    onDismiss();
  };

  return (
    <Modal
      title={t('dashboard-prompt.modal.title', 'What do you want to monitor?')}
      isOpen={true}
      onDismiss={onDismiss}
      className={styles.modal}
      contentClassName={styles.content}
      // The prompt card focuses its own input on mount; without this the modal's
      // focus manager races it and lands on the close button instead.
      initialFocus={-1}
    >
      <DashboardPrompt onSubmitPrompt={handleSubmitPrompt} onDismiss={onDismiss} />
    </Modal>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.md,
    }),
    // Modal's default content box pads the top and leaves the bottom edge to a
    // margin, which detaches the subtext from the title and crowds the prompt
    // card. No top padding so the subtext reads as part of the header, and a
    // real 24px bottom padding in place of the margin.
    content: css({
      padding: theme.spacing(0, 3, 3, 3),
      marginBottom: 0,
    }),
  };
}
