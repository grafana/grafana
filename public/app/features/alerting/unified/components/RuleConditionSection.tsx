import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Combobox,
  ComboboxOption,
  Icon,
  InlineField,
  InlineFieldRow,
  Input,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ThresholdSelect } from 'app/features/expressions/components/ThresholdSelect';
import { ToLabel } from 'app/features/expressions/components/ToLabel';
import { reducerTypes, thresholdFunctions } from 'app/features/expressions/types';
import { isRangeEvaluator } from 'app/features/expressions/utils/expressionTypes';

import { RuleFormType, RuleFormValues } from '../types/rule-form';

// no custom pending/eval parsing here; use defaults from form
import { EvaluationGroupFieldRow } from './rule-editor/EvaluationGroupFieldRow';

export function RuleConditionSection({ type }: { type: RuleFormType }) {
  const base = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();
  const evaluateFor = watch('evaluateFor') || '0s';
  watch('folder');

  type LocalSimpleCondition = { whenField?: string; evaluator: { params: number[]; type: EvalFunction } };
  const [simpleCondition, setSimpleCondition] = useState<LocalSimpleCondition>({
    whenField: ReducerID.last,
    evaluator: { params: [0], type: EvalFunction.IsAbove },
  });

  const reducerOptions: Array<ComboboxOption<string>> = reducerTypes
    .filter((o) => typeof o.value === 'string')
    .map((o) => ({ value: o.value ?? '', label: o.label ?? String(o.value) }));

  const onReducerTypeChange = (v: ComboboxOption<string> | null) => {
    const value = v?.value ?? ReducerID.last;
    setSimpleCondition((prev) => ({ ...prev, whenField: value }));
  };
  const isRange = isRangeEvaluator(simpleCondition.evaluator.type);
  const thresholdFunction = thresholdFunctions.find((fn) => fn.value === simpleCondition.evaluator?.type);
  const onEvalFunctionChange = (v: SelectableValue<EvalFunction>) => {
    setSimpleCondition((prev) => ({
      ...prev,
      evaluator: { ...prev.evaluator, type: v.value ?? EvalFunction.IsAbove },
    }));
  };
  const onEvaluateValueChange = (e: React.FormEvent<HTMLInputElement>, index = 0) => {
    const value = parseFloat(e.currentTarget.value) || 0;
    setSimpleCondition((prev) => ({
      ...prev,
      evaluator: {
        ...prev.evaluator,
        params: index === 0 ? [value, prev.evaluator.params[1]] : [prev.evaluator.params[0], value],
      },
    }));
  };

  return (
    <div className={base.section}>
      <div className={base.sectionHeaderRow}>
        <span className={base.stepBadge}>
          <Trans i18nKey="alerting.simplified.step-number-two">2</Trans>
        </span>
        <div className={base.sectionHeader}>
          <Trans i18nKey="alerting.simplified.condition.title">Condition</Trans>
        </div>
      </div>

      <div className={base.contentIndented}>
        <Stack direction="column" gap={2}>
          <InlineFieldRow>
            {simpleCondition.whenField && (
              <InlineField label={t('alerting.simple-condition-editor.label-when', 'WHEN')}>
                <Combobox
                  options={reducerOptions}
                  value={simpleCondition.whenField}
                  onChange={onReducerTypeChange}
                  width={20}
                />
              </InlineField>
            )}
            <InlineField
              label={
                simpleCondition.whenField
                  ? t('alerting.simple-condition-editor.label-of-query', 'OF QUERY')
                  : t('alerting.simple-condition-editor.label-when-query', 'WHEN QUERY')
              }
            >
              <Stack direction="row" gap={1} alignItems="center">
                <ThresholdSelect onChange={onEvalFunctionChange} value={thresholdFunction} />
                {isRange ? (
                  <>
                    <Input
                      type="number"
                      width={10}
                      key={simpleCondition.evaluator.params[0]}
                      defaultValue={simpleCondition.evaluator.params[0] ?? ''}
                      onBlur={(event) => onEvaluateValueChange(event, 0)}
                    />
                    <ToLabel />
                    <Input
                      type="number"
                      width={10}
                      key={simpleCondition.evaluator.params[1]}
                      defaultValue={simpleCondition.evaluator.params[1] ?? ''}
                      onBlur={(event) => onEvaluateValueChange(event, 1)}
                    />
                  </>
                ) : (
                  <Input
                    type="number"
                    width={10}
                    key={simpleCondition.evaluator.params[0]}
                    defaultValue={simpleCondition.evaluator.params[0] ?? ''}
                    onBlur={(event) => onEvaluateValueChange(event, 0)}
                  />
                )}
              </Stack>
            </InlineField>
          </InlineFieldRow>

          <EvaluationGroupFieldRow enableProvisionedGroups={false} />

          {evaluateFor === '0s' && (
            <Stack direction="row" gap={0.5} alignItems="center">
              <Icon name="exclamation-triangle" />
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.simplified.evaluation.immediate-warning">
                  Immediate firing might lead to unnecessary alerts being sent for temporary issues
                </Trans>
              </Text>
            </Stack>
          )}
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({ width: '100%' }),
    sectionHeaderRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      fontWeight: 600,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
    stepBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
      width: 20,
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: 600,
    }),
    contentIndented: css({ marginLeft: `calc(20px + ${theme.spacing(1)})` }),
    paragraphRow: css({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(1) }),
    inlineField: css({ display: 'inline-flex' }),
  };
}
