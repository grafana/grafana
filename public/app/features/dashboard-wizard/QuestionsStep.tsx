import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { type WizardQuestion } from './types';

interface Props {
  questions: WizardQuestion[];
  answers: Record<string, string[]>;
  onAnswersChange: (answers: Record<string, string[]>) => void;
  onContinue: () => void;
  onBack: () => void;
}

/** Optional wizard screen: one round of clarifying questions before the review step. */
export function QuestionsStep({ questions, answers, onAnswersChange, onContinue, onBack }: Props) {
  const styles = useStyles2(getStyles);

  const toggleOption = (question: WizardQuestion, value: string) => {
    if (!question.allowMultiple) {
      onAnswersChange({ ...answers, [question.id]: [value] });
      return;
    }
    const current = answers[question.id] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onAnswersChange({ ...answers, [question.id]: next });
  };

  return (
    <div className={styles.container}>
      <Text element="h3" variant="h5">
        {t('dashboard-wizard.questions-step.title', 'A couple of quick questions')}
      </Text>

      {questions.map((question) => {
        const selected = answers[question.id] ?? [];
        return (
          <div key={question.id} className={styles.question}>
            <Text element="h4" variant="bodySmall" weight="medium">
              {question.text}
            </Text>

            <div
              className={styles.options}
              role={question.allowMultiple ? 'group' : 'radiogroup'}
              aria-label={question.text}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }
                const digit = Number(event.key);
                if (digit >= 1 && digit <= question.options.length) {
                  event.preventDefault();
                  toggleOption(question, question.options[digit - 1]);
                }
              }}
            >
              {question.options.map((option, index) => {
                const isSelected = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    role={question.allowMultiple ? 'checkbox' : 'radio'}
                    aria-checked={isSelected}
                    className={cx(styles.optionItem, isSelected && styles.optionItemSelected)}
                    onClick={() => toggleOption(question, option)}
                  >
                    <span
                      className={cx(
                        styles.indicator,
                        question.allowMultiple ? styles.indicatorSquare : styles.indicatorCircle,
                        isSelected && styles.indicatorSelected
                      )}
                    >
                      {isSelected ? (
                        <Icon name="check" size="xs" />
                      ) : (
                        <span className={styles.number}>{index + 1}</span>
                      )}
                    </span>
                    <span className={styles.optionLabel}>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <Stack justifyContent="space-between">
        <Button variant="secondary" fill="outline" onClick={onBack}>
          {t('dashboard-wizard.questions-step.back', 'Back')}
        </Button>
        <Button onClick={onContinue} icon="arrow-right">
          {t('dashboard-wizard.questions-step.continue', 'Continue')}
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
    question: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    options: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      outline: 'none',
    }),
    optionItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
      textAlign: 'left',
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['border-color', 'background-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:hover': {
        borderColor: theme.colors.primary.border,
        background: theme.colors.primary.transparent,
      },
    }),
    optionItemSelected: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
    }),
    indicator: css({
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      border: `1.5px solid ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['border-color', 'background-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    indicatorCircle: css({
      borderRadius: theme.shape.radius.circle,
    }),
    indicatorSquare: css({
      borderRadius: theme.shape.radius.default,
    }),
    indicatorSelected: css({
      border: 'none',
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      '& svg': { display: 'block' },
    }),
    number: css({
      fontSize: '11px',
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1,
    }),
    optionLabel: css({
      flex: 1,
      minWidth: 0,
      lineHeight: 1.3,
    }),
  };
}
