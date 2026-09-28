import { useId, useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, type ComboboxOption, Field, MultiCombobox, Stack, TextArea } from '@grafana/ui';

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
  const sourcesId = useId();
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [sourcePanelKeys, setSourcePanelKeys] = useState<string[]>(initial?.sourcePanelKeys ?? []);

  const options = useMemo(() => {
    const available: Array<ComboboxOption<string>> = sources.map((source) => ({
      value: source.key,
      label: source.title,
    }));
    // Keep saved sources that no longer exist selectable, so the author can see and remove them.
    const unavailable = sourcePanelKeys
      .filter((key) => !sources.some((source) => source.key === key))
      .map((key) => ({
        value: key,
        label: t('dashboard.insights.form.source-unavailable', '{{key}} (unavailable)', { key }),
      }));
    return [...available, ...unavailable];
  }, [sources, sourcePanelKeys]);

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
            rows={3}
            value={question}
            placeholder={t('dashboard.insights.form.question-placeholder', 'What changed in error rates this week?')}
            onChange={(event) => setQuestion(event.currentTarget.value)}
          />
        </Field>
        <Field
          label={t('dashboard.insights.form.sources-label', 'Source panels')}
          description={t(
            'dashboard.insights.form.sources-description',
            'Assistant answers using only the data these panels show.'
          )}
          htmlFor={sourcesId}
          required
          noMargin
        >
          <MultiCombobox
            id={sourcesId}
            options={options}
            value={sourcePanelKeys}
            placeholder={t('dashboard.insights.form.sources-placeholder', 'Select panels')}
            onChange={(selected) => setSourcePanelKeys(selected.map((option) => option.value))}
          />
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
