import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { type GrafanaTheme2, ReducerID, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Icon, InlineField, InlineFieldRow, Input, Stack, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ThresholdSelect } from 'app/features/expressions/components/ThresholdSelect';
import { ToLabel } from 'app/features/expressions/components/ToLabel';
import { ExpressionDatasourceUID, reducerTypes, thresholdFunctions } from 'app/features/expressions/types';
import { isRangeEvaluator } from 'app/features/expressions/utils/expressionTypes';

import { createSimpleConditionExpressions } from '../rule-editor/formProcessing';
import { type RuleFormValues, type SimpleCondition } from '../types/rule-form';

import { EvaluationGroupFieldRow } from './rule-editor/EvaluationGroupFieldRow';

const DEFAULT_SIMPLE_CONDITION: SimpleCondition = {
  whenField: ReducerID.last,
  evaluator: { params: [0], type: EvalFunction.IsAbove },
};

export function RuleConditionSection() {
  const base = useStyles2(getStyles);
  const { watch, setValue, getValues } = useFormContext<RuleFormValues>();
  const evaluateFor = watch('evaluateFor') || '0s';

  const [simpleCondition, setSimpleCondition] = useState<SimpleCondition>(DEFAULT_SIMPLE_CONDITION);

  /**
   * Updates the form's queries and condition based on the current simple condition.
   * Called directly from onChange handlers to avoid the complexity of syncing
   * local state to form state via useEffect.
   */
  const updateFormQueries = useCallback(
    (newCondition: SimpleCondition) => {
      const currentQueries = getValues('queries');
      const dataQueries = currentQueries.filter((q) => q.datasourceUid !== ExpressionDatasourceUID);

      if (dataQueries.length === 0) {
        return;
      }

      const { queries: newQueries, condition } = createSimpleConditionExpressions(newCondition, dataQueries);
      setValue('queries', newQueries, { shouldDirty: false, shouldValidate: false });
      setValue('condition', condition, { shouldDirty: false, shouldValidate: false });
    },
    [getValues, setValue]
  );

  const reducerOptions: Array<ComboboxOption<string>> = reducerTypes
    .filter((o) => typeof o.value === 'string')
    .map((o) => ({ value: o.value ?? '', label: o.label ?? String(o.value) }));

  const onReducerTypeChange = useCallback(
    (v: ComboboxOption<string> | null) => {
      const value = v?.value ?? ReducerID.last;
      const newCondition: SimpleCondition = { ...simpleCondition, whenField: value };
      setSimpleCondition(newCondition);
      updateFormQueries(newCondition);
    },
    [simpleCondition, updateFormQueries]
  );

  const isRange = isRangeEvaluator(simpleCondition.evaluator.type);
  const thresholdFunction = thresholdFunctions.find((fn) => fn.value === simpleCondition.evaluator?.type);

  const onEvalFunctionChange = useCallback(
    (v: SelectableValue<EvalFunction>) => {
      const newCondition: SimpleCondition = {
        ...simpleCondition,
        evaluator: { ...simpleCondition.evaluator, type: v.value ?? EvalFunction.IsAbove },
      };
      setSimpleCondition(newCondition);
      updateFormQueries(newCondition);
    },
    [simpleCondition, updateFormQueries]
  );

  const onEvaluateValueChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>, index = 0) => {
      const value = parseFloat(e.currentTarget.value) || 0;
      const newParams =
        index === 0 ? [value, simpleCondition.evaluator.params[1]] : [simpleCondition.evaluator.params[0], value];
      const newCondition: SimpleCondition = {
        ...simpleCondition,
        evaluator: { ...simpleCondition.evaluator, params: newParams },
      };
      setSimpleCondition(newCondition);
      updateFormQueries(newCondition);
    },
    [simpleCondition, updateFormQueries]
  );

  return (
    <section className={base.section} aria-labelledby="condition-section-heading">
      <div className={base.sectionHeaderRow}>
        <Text element="h3" variant="h4" id="condition-section-heading">
          {`2. `}
          <Trans i18nKey="alerting.simplified.condition.title">Condition</Trans>
        </Text>
      </div>

      <div>
        <Stack direction="column" gap={2}>
          <InlineFieldRow>
            {simpleCondition.whenField && (
              <InlineField label={t('alerting.simple-condition-editor.label-when', 'WHEN')}>
                <Combobox
                  options={reducerOptions}
                  value={simpleCondition.whenField}
                  onChange={onReducerTypeChange}
                  width={20}
                  aria-label={t('alerting.simple-condition-editor.aria-label-reducer', 'Select reducer function')}
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
                      aria-label={t(
                        'alerting.simple-condition-editor.aria-label-threshold-from',
                        'Threshold from value'
                      )}
                    />
                    <ToLabel />
                    <Input
                      type="number"
                      width={10}
                      key={simpleCondition.evaluator.params[1]}
                      defaultValue={simpleCondition.evaluator.params[1] ?? ''}
                      onBlur={(event) => onEvaluateValueChange(event, 1)}
                      aria-label={t('alerting.simple-condition-editor.aria-label-threshold-to', 'Threshold to value')}
                    />
                  </>
                ) : (
                  <Input
                    type="number"
                    width={10}
                    key={simpleCondition.evaluator.params[0]}
                    defaultValue={simpleCondition.evaluator.params[0] ?? ''}
                    onBlur={(event) => onEvaluateValueChange(event, 0)}
                    aria-label={t('alerting.simple-condition-editor.aria-label-threshold', 'Threshold value')}
                  />
                )}
              </Stack>
            </InlineField>
          </InlineFieldRow>

          <EvaluationGroupFieldRow enableProvisionedGroups={false} />

          {evaluateFor === '0s' && (
            <Stack direction="row" gap={0.5} alignItems="center">
              <Icon name="exclamation-triangle" aria-hidden="true" />
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.simplified.evaluation.immediate-warning">
                  Immediate firing might lead to unnecessary alerts being sent for temporary issues
                </Trans>
              </Text>
            </Stack>
          )}
        </Stack>
      </div>
    </section>
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
  };
}
