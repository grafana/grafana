import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { WizardContextPicker } from './WizardContextPicker';
import { getWizardDatasources } from './api';
import { formatContextItemsForPrompt, scopeDatasourcesToContext } from './context';
import {
  cancelDashboardGenerationPrewarm,
  prewarmDashboardGeneration,
  startDashboardGeneration,
} from './generationState';
import { buildImprovementPrompt } from './prompts';

/** Origin reported to the assistant for "improve this dashboard" runs. */
const IMPROVE_ORIGIN = 'grafana/dashboard-wizard-improve';

interface Props {
  dashboard: DashboardScene;
  onDismiss: () => void;
}

/**
 * "Improve this dashboard": the lightweight sibling of the generate-dashboard
 * wizard. The user says what to change about the dashboard that is open —
 * optionally attaching specific datasources, metrics, or dashboards as
 * context — and the assistant's dashboarding agent applies the improvements
 * headlessly, in place, behind the same blocking overlay. There is no
 * refinement round: the request is already anchored to a concrete dashboard,
 * which the agent reads before touching anything. Changes are left unsaved
 * for the user to review.
 */
export function ImproveDashboardModal({ dashboard, onDismiss }: Props) {
  const styles = useStyles2(getStyles);

  const [freeText, setFreeText] = useState('');
  const [contextItems, setContextItems] = useState<ChatContextItem[]>([]);

  useEffect(() => {
    reportInteraction('dashboard_wizard_improve_opened');
    // Let the host pre-create the assistant session the run will use.
    prewarmDashboardGeneration(IMPROVE_ORIGIN);
    return () => cancelDashboardGenerationPrewarm();
  }, []);

  const handleAddContextItem = (item: ChatContextItem) => {
    setContextItems((prev) => (prev.some((existing) => existing.node.id === item.node.id) ? prev : [...prev, item]));
  };

  const handleRemoveContextItem = (item: ChatContextItem) => {
    setContextItems((prev) => prev.filter((existing) => existing.node.id !== item.node.id));
  };

  const canSubmit = freeText.trim() !== '';

  const handleSubmit = () => {
    const request = freeText.trim();
    if (request === '') {
      return;
    }

    reportInteraction('dashboard_wizard_improve_generated', { contextItems: contextItems.length });

    // The agent mutates the live scene, so the dashboard must be in edit mode
    // — that is also what keeps the changes reviewable and unsaved.
    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    const contextNotes = formatContextItemsForPrompt(contextItems);

    startDashboardGeneration({
      origin: IMPROVE_ORIGIN,
      target: 'current',
      prompt: buildImprovementPrompt({
        request,
        dashboardTitle: dashboard.state.title,
        datasources: scopeDatasourcesToContext(getWizardDatasources(), contextItems),
        contextNotes: contextNotes || undefined,
      }),
    });

    onDismiss();
  };

  return (
    <Modal
      title={t('dashboard-wizard.improve-modal.title', 'Improve this dashboard')}
      isOpen={true}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <div className={styles.container}>
        <Field
          label={t('dashboard-wizard.improve-modal.label', 'What should the Assistant improve?')}
          description={t(
            'dashboard-wizard.improve-modal.description',
            'Describe the changes — add panels, reorganize sections, fix queries, add variables, polish the visuals.'
          )}
          noMargin
        >
          <TextArea
            value={freeText}
            onChange={(e) => setFreeText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSubmit) {
                  handleSubmit();
                }
              }
            }}
            placeholder={t(
              'dashboard-wizard.improve-modal.placeholder',
              'e.g. Add a section with error rates per service, and a variable to filter by namespace'
            )}
            rows={4}
          />
        </Field>

        <WizardContextPicker items={contextItems} onAdd={handleAddContextItem} onRemove={handleRemoveContextItem} />

        <Stack justifyContent="flex-end">
          <Button onClick={handleSubmit} disabled={!canSubmit} icon="ai-sparkle">
            {t('dashboard-wizard.improve-modal.submit', 'Improve it')}
          </Button>
        </Stack>
      </div>
    </Modal>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.md,
    }),
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
}
