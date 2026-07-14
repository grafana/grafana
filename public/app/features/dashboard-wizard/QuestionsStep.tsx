import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Checkbox, Field, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';

import { type WizardQuestion } from './types';

interface Props {
  questions: WizardQuestion[];
  answers: Record<string, string[]>;
  onAnswersChange: (answers: Record<string, string[]>) => void;
  onGenerate: () => void;
  onBack: () => void;
}

/** Optional third wizard screen: one round of clarifying questions. */
export function QuestionsStep({ questions, answers, onAnswersChange, onGenerate, onBack }: Props) {
  const styles = useStyles2(getStyles);

  const setSingleAnswer = (questionId: string, value: string) => {
    onAnswersChange({ ...answers, [questionId]: [value] });
  };

  const toggleMultiAnswer = (questionId: string, value: string) => {
    const current = answers[questionId] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onAnswersChange({ ...answers, [questionId]: next });
  };

  return (
    <div className={styles.container}>
      <Text element="h3" variant="h5">
        {t('dashboard-wizard.questions-step.title', 'A couple of quick questions')}
      </Text>

      {questions.map((question) => (
        <Field key={question.id} label={question.text} noMargin>
          {question.allowMultiple ? (
            <Stack direction="column" gap={0.5}>
              {question.options.map((option) => (
                <Checkbox
                  key={option}
                  label={option}
                  checked={(answers[question.id] ?? []).includes(option)}
                  onChange={() => toggleMultiAnswer(question.id, option)}
                />
              ))}
            </Stack>
          ) : (
            <RadioButtonGroup
              options={question.options.map((option) => ({ label: option, value: option }))}
              value={answers[question.id]?.[0]}
              onChange={(value) => setSingleAnswer(question.id, value)}
            />
          )}
        </Field>
      ))}

      <Stack justifyContent="space-between">
        <Button variant="secondary" fill="outline" onClick={onBack}>
          {t('dashboard-wizard.questions-step.back', 'Back')}
        </Button>
        <Button onClick={onGenerate} icon="ai-sparkle">
          {t('dashboard-wizard.questions-step.generate', 'Generate dashboard')}
        </Button>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
}
