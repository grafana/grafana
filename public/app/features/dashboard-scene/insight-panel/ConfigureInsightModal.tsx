import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Modal } from '@grafana/ui';
import { type InsightOptions } from 'app/plugins/panel/text/panelcfg.gen';

import { type DashboardScene } from '../scene/DashboardScene';
import { getInsightSourcePanels } from '../sidebar/insights/sources';

import { cleanInsight, InsightQuestionFields, isInsightComplete } from './InsightQuestionFields';

export interface ConfigureInsightModalProps {
  dashboard: DashboardScene;
  /** The panel being configured — never offered as one of its own sources. */
  panelId: number;
  onDismiss: () => void;
  onConfirm: (insight: InsightOptions) => void;
}

export function ConfigureInsightModal({ dashboard, panelId, onDismiss, onConfirm }: ConfigureInsightModalProps) {
  // The panel being configured has no data of its own to answer from, so exclude it.
  const sources = useMemo(
    () => getInsightSourcePanels(dashboard).filter((source) => source.key !== `panel-${panelId}`),
    [dashboard, panelId]
  );

  const [insight, setInsight] = useState<InsightOptions>(() => ({
    question: t('dashboard.insight-panel.default-question', 'Show insights of this panel or panels'),
    sourcePanelKeys: [],
    followUps: [],
  }));

  return (
    <Modal
      title={t('dashboard.insight-panel.modal-title', 'Configure insight')}
      isOpen={true}
      onDismiss={onDismiss}
      closeOnBackdropClick={false}
    >
      <InsightQuestionFields dashboard={dashboard} value={insight} sources={sources} onChange={setInsight} />

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard.insight-panel.cancel">Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          disabled={!isInsightComplete(insight)}
          onClick={() => onConfirm(cleanInsight(insight))}
        >
          <Trans i18nKey="dashboard.insight-panel.create">Create insight panel</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
