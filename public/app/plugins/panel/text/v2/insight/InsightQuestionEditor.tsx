import { type StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextArea } from '@grafana/ui';

export function InsightQuestionEditor({ value, onChange }: StandardEditorProps<string>) {
  return (
    <TextArea
      rows={4}
      value={value ?? ''}
      placeholder={t('textng.insight.question-placeholder', 'What changed in error rates this week?')}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
