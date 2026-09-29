import { useMemo, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Field, Modal, MultiSelect, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from '../utils/unconfiguredPanelUtils';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

import { type InsightPanelConfig, type InsightPanelRef, type InsightScope } from './types';

export interface ConfigureInsightModalProps {
  dashboard: DashboardScene;
  /** The panel being configured — never offered as its own context. */
  panelId: number;
  onDismiss: () => void;
  onConfirm: (config: InsightPanelConfig) => void;
}

/** Panels the assistant can be pointed at: everything configured, minus the panel being edited. */
function useContextPanelOptions(
  dashboard: DashboardScene,
  panelId: number
): Array<SelectableValue<number> & { panelTitle: string }> {
  return useMemo(
    () =>
      dashboard.state.body
        .getVizPanels()
        .filter((panel) => panel.state.pluginId !== UNCONFIGURED_PANEL_PLUGIN_ID)
        .map((panel) => ({ panel, id: getPanelIdForVizPanel(panel) }))
        .filter(({ id }) => id !== panelId)
        .map(({ panel, id }) => {
          const panelTitle = panel.state.title || t('dashboard.insight-panel.untitled-panel', 'Untitled panel');
          return { value: id, label: `${panelTitle} (${id})`, panelTitle };
        }),
    [dashboard, panelId]
  );
}

export function ConfigureInsightModal({ dashboard, panelId, onDismiss, onConfirm }: ConfigureInsightModalProps) {
  const panelOptions = useContextPanelOptions(dashboard, panelId);

  const [scope, setScope] = useState<InsightScope>(panelOptions.length > 0 ? 'panels' : 'dashboard');
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [prompt, setPrompt] = useState(
    t('dashboard.insight-panel.default-prompt', 'Show insights of this panel or panels')
  );

  const scopeOptions: Array<SelectableValue<InsightScope>> = [
    { value: 'panels', label: t('dashboard.insight-panel.scope-panels', 'Specific panels') },
    { value: 'dashboard', label: t('dashboard.insight-panel.scope-dashboard', 'Whole dashboard') },
  ];

  const missingPanels = scope === 'panels' && selectedPanelIds.length === 0;
  const missingPrompt = prompt.trim().length === 0;

  const onCreate = () => {
    const panels: InsightPanelRef[] =
      scope === 'dashboard'
        ? []
        : selectedPanelIds.map((id) => ({
            panelId: id,
            panelTitle: panelOptions.find((option) => option.value === id)?.panelTitle ?? String(id),
          }));

    onConfirm({
      prompt: prompt.trim(),
      context: {
        scope,
        dashboardUid: dashboard.state.uid,
        dashboardTitle: dashboard.state.title,
        panels,
      },
    });
  };

  return (
    <Modal
      title={t('dashboard.insight-panel.modal-title', 'Configure insight')}
      isOpen={true}
      onDismiss={onDismiss}
      closeOnBackdropClick={false}
    >
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('dashboard.insight-panel.scope-label', 'Panel context')}
          description={t(
            'dashboard.insight-panel.scope-description',
            'What the assistant looks at when it writes the insight.'
          )}
        >
          <RadioButtonGroup options={scopeOptions} value={scope} onChange={setScope} />
        </Field>

        {scope === 'panels' && (
          <Field noMargin label={t('dashboard.insight-panel.panels-label', 'Panels')}>
            <MultiSelect
              inputId="insight-context-panels"
              options={panelOptions}
              value={selectedPanelIds}
              onChange={(selected) => setSelectedPanelIds(selected.map((option) => option.value!))}
              placeholder={t('dashboard.insight-panel.panels-placeholder', 'Select panels')}
              noOptionsMessage={t('dashboard.insight-panel.panels-empty', 'This dashboard has no other panels')}
              isClearable
            />
          </Field>
        )}

        <Field
          noMargin
          label={t('dashboard.insight-panel.prompt-label', 'Prompt')}
          description={t(
            'dashboard.insight-panel.prompt-description',
            'What you want to know about the panels in context.'
          )}
        >
          <TextArea
            id="insight-prompt"
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
          />
        </Field>
      </Stack>

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard.insight-panel.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" onClick={onCreate} disabled={missingPanels || missingPrompt}>
          <Trans i18nKey="dashboard.insight-panel.create">Create insight panel</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
