import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Field, Modal, Stack, Text, TextArea } from '@grafana/ui';
import { type InsightOptions } from 'app/plugins/panel/text/panelcfg.gen';

import { type DashboardScene } from '../scene/DashboardScene';
import { InsightSourcePicker } from '../sidebar/insights/InsightSourcePicker';
import { getInsightSourcePanels } from '../sidebar/insights/sources';

import { InsightFollowUpsList } from './InsightFollowUpsList';

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

  const [question, setQuestion] = useState(
    t('dashboard.insight-panel.default-question', 'Show insights of this panel or panels')
  );
  const [sourcePanelKeys, setSourcePanelKeys] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);

  const canCreate = question.trim() !== '' && sourcePanelKeys.length > 0;

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
          label={t('dashboard.insight-panel.question-label', 'Question')}
          description={t(
            'dashboard.insight-panel.question-description',
            'What Assistant answers using only the data the source panels show.'
          )}
        >
          <TextArea
            id="insight-question"
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
          />
        </Field>

        <Field
          noMargin
          label={t('dashboard.insight-panel.sources-label', 'Source panels')}
          description={t(
            'dashboard.insight-panel.sources-description',
            'Assistant answers using only the data these panels show. Selecting a tab or row includes every panel in it.'
          )}
        >
          {sources.length > 0 ? (
            <InsightSourcePicker sources={sources} value={sourcePanelKeys} onChange={setSourcePanelKeys} />
          ) : (
            <Text element="p" variant="bodySmall" color="secondary">
              <Trans i18nKey="dashboard.insight-panel.sources-empty">
                This dashboard has no other panels with queries to use as sources.
              </Trans>
            </Text>
          )}
        </Field>

        <Field
          noMargin
          label={t('dashboard.insight-panel.follow-ups-label', 'Follow-up questions')}
          description={t(
            'dashboard.insight-panel.follow-ups-description',
            'Optional. Offered after the answer, each one answered inside the panel against the same data.'
          )}
        >
          <InsightFollowUpsList value={followUps} onChange={setFollowUps} />
        </Field>
      </Stack>

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard.insight-panel.cancel">Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          disabled={!canCreate}
          onClick={() =>
            onConfirm({
              question: question.trim(),
              sourcePanelKeys,
              // Blank rows are the author's in-progress input, not questions to offer.
              followUps: followUps.map((followUp) => followUp.trim()).filter(Boolean),
            })
          }
        >
          <Trans i18nKey="dashboard.insight-panel.create">Create insight panel</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
