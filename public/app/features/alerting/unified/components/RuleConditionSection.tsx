import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, ReducerID, SelectableValue, getNextRefId } from '@grafana/data';
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
import {
  ExpressionDatasourceUID,
  ExpressionQuery,
  ExpressionQueryType,
  reducerTypes,
  thresholdFunctions,
} from 'app/features/expressions/types';
import { isRangeEvaluator } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormValues } from '../types/rule-form';

import { EvaluationGroupFieldRow } from './rule-editor/EvaluationGroupFieldRow';

export interface SimpleCondition {
  whenField: string;
  evaluator: {
    params: number[];
    type: EvalFunction;
  };
}

const DEFAULT_SIMPLE_CONDITION: SimpleCondition = {
  whenField: ReducerID.last,
  evaluator: { params: [0], type: EvalFunction.IsAbove },
};

/**
 * Creates expression queries (reduce + threshold) from a simple condition configuration.
 * This is used by the simplified alert rule drawer to generate expressions based on
 * user-selected reducer and threshold values.
 */
export function createSimpleConditionExpressions(
  simpleCondition: SimpleCondition,
  dataQueries: AlertQuery[]
): { queries: AlertQuery[]; condition: string } {
  if (dataQueries.length === 0) {
    return { queries: [], condition: '' };
  }

  const lastDataQueryRefId = dataQueries[dataQueries.length - 1].refId;

  // Calculate stable refIds for expressions
  const reduceRefId = getNextRefId(dataQueries);
  const tempQueries = [...dataQueries, { refId: reduceRefId, datasourceUid: '', queryType: '', model: {} }];
  const thresholdRefId = getNextRefId(tempQueries);

  const reduceExpression: ExpressionQuery = {
    refId: reduceRefId,
    type: ExpressionQueryType.reduce,
    datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID },
    reducer: simpleCondition.whenField,
    expression: lastDataQueryRefId,
  };

  const thresholdExpression: ExpressionQuery = {
    refId: thresholdRefId,
    type: ExpressionQueryType.threshold,
    datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID },
    conditions: [
      {
        type: 'query',
        evaluator: {
          params: simpleCondition.evaluator.params,
          type: simpleCondition.evaluator.type,
        },
        operator: { type: 'and' },
        query: { params: [thresholdRefId] },
        reducer: { params: [], type: 'last' as const },
      },
    ],
    expression: reduceRefId,
  };

  const expressionQueries: AlertQuery[] = [
    {
      refId: reduceRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: reduceExpression,
    },
    {
      refId: thresholdRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: thresholdExpression,
    },
  ];

  return {
    queries: [...dataQueries, ...expressionQueries],
    condition: thresholdRefId,
  };
}

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
