import { t } from '@grafana/i18n';
import { useFlagGrafanaNewTextPanel, useFlagTextNewFeatures } from '@grafana/runtime/internal';
import { IconButton, Stack } from '@grafana/ui';
import { InsightView } from 'app/plugins/panel/text/v2/insight/InsightView';

import { InsightCard } from './InsightCard';
import { InsightQuestionForm } from './InsightQuestionForm';
import { moveInsightQuestionToPanel } from './insightMoves';
import { deleteInsightQuestion, moveInsightQuestion, updateInsightQuestion } from './insightsEditActions';
import { type InsightsDashboard } from './insightsStorage';
import { type InsightSourcePanel } from './sources';
import { type InsightQuestion } from './types';

interface Props {
  dashboard: InsightsDashboard;
  questions: InsightQuestion[];
  index: number;
  sources: InsightSourcePanel[];
  isEditing: boolean;
  isFormOpen: boolean;
  onEdit: () => void;
  onCloseForm: () => void;
}

/** A saved question, asked and answered exactly like an Insight panel. */
export function InsightQuestionItem({
  dashboard,
  questions,
  index,
  sources,
  isEditing,
  isFormOpen,
  onEdit,
  onCloseForm,
}: Props) {
  const question = questions[index];
  // Insight panels are a mode of the new Text panel.
  const hasNewTextPanel = useFlagGrafanaNewTextPanel();
  const hasTextNewFeatures = useFlagTextNewFeatures();

  return (
    <InsightCard>
      {isEditing && (
        <Stack gap={0.5} justifyContent="flex-end">
          <IconButton
            name="pen"
            size="sm"
            tooltip={t('dashboard.insights.item.edit', 'Edit question')}
            disabled={isFormOpen}
            onClick={onEdit}
          />
          {hasNewTextPanel && hasTextNewFeatures && (
            <IconButton
              name="panel-add"
              size="sm"
              tooltip={t('dashboard.insights.item.move-to-panel', 'Move to the dashboard as an Insight panel')}
              disabled={isFormOpen}
              onClick={() => moveInsightQuestionToPanel(dashboard, question.id)}
            />
          )}
          <IconButton
            name="arrow-up"
            size="sm"
            tooltip={t('dashboard.insights.item.move-up', 'Move up')}
            disabled={index === 0}
            onClick={() => moveInsightQuestion(dashboard, questions, index, -1)}
          />
          <IconButton
            name="arrow-down"
            size="sm"
            tooltip={t('dashboard.insights.item.move-down', 'Move down')}
            disabled={index === questions.length - 1}
            onClick={() => moveInsightQuestion(dashboard, questions, index, 1)}
          />
          <IconButton
            name="trash-alt"
            size="sm"
            tooltip={t('dashboard.insights.item.delete', 'Delete question')}
            onClick={() => deleteInsightQuestion(dashboard, questions, question.id)}
          />
        </Stack>
      )}

      {isEditing && isFormOpen ? (
        <InsightQuestionForm
          dashboard={dashboard}
          initial={question}
          sources={sources}
          onSave={(draft) => {
            updateInsightQuestion(dashboard, questions, question.id, draft);
            onCloseForm();
          }}
          onCancel={onCloseForm}
        />
      ) : (
        <InsightView dashboard={dashboard} sessionId={question.id} options={question} fitContent />
      )}
    </InsightCard>
  );
}
