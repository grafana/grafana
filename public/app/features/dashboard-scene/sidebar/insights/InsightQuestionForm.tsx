import { useId, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Field, Stack, TextArea } from '@grafana/ui';

import { InsightSourcePicker } from './InsightSourcePicker';
import { type InsightQuestionDraft } from './insightsEditActions';
import { type InsightSourcePanel } from './sources';

interface Props {
  initial?: InsightQuestionDraft;
  sources: InsightSourcePanel[];
  onSave: (draft: InsightQuestionDraft) => void;
  onCancel: () => void;
}

export function InsightQuestionForm({ initial, sources, onSave, onCancel }: Props) {
  const questionId = useId();
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [sourcePanelKeys, setSourcePanelKeys] = useState<string[]>(initial?.sourcePanelKeys ?? []);

  const canSave = question.trim() !== '' && sourcePanelKeys.length > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          onSave({ question: question.trim(), sourcePanelKeys });
        }
      }}
    >
      <Stack direction="column" gap={2}>
        <Field label={t('dashboard.insights.form.question-label', 'Question')} htmlFor={questionId} required noMargin>
          <TextArea
            id={questionId}
            autoFocus
            rows={4}
            value={question}
            placeholder={t(
              'dashboard.insights.form.question-placeholder',
              'What would you like to understand about these panels?'
            )}
            onChange={(event) => setQuestion(event.currentTarget.value)}
          />
        </Field>
        <Field
          label={t('dashboard.insights.form.sources-label', 'Sources')}
          description={t(
            'dashboard.insights.form.sources-description',
            'A tab or row includes every panel in it, including panels added later.'
          )}
          required
          noMargin
        >
          <InsightSourcePicker sources={sources} value={sourcePanelKeys} onChange={setSourcePanelKeys} />
        </Field>
        <Stack gap={1}>
          <Button type="submit" size="sm" disabled={!canSave}>
            <Trans i18nKey="dashboard.insights.form.save-question">Save</Trans>
          </Button>
          <Button type="button" size="sm" variant="secondary" fill="outline" onClick={onCancel}>
            <Trans i18nKey="dashboard.insights.form.cancel-edit">Cancel</Trans>
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
