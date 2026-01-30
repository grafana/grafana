import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
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
import { ExpressionQuery, ExpressionQueryType, reducerTypes, thresholdFunctions } from 'app/features/expressions/types';
import { isRangeEvaluator } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormValues } from '../types/rule-form';

import { EvaluationGroupFieldRow } from './rule-editor/EvaluationGroupFieldRow';

const ExpressionDatasourceUID = '__expr__';

type LocalSimpleCondition = { whenField?: string; evaluator: { params: number[]; type: EvalFunction } };

/**
 * Creates expression queries (reduce + threshold) from a simple condition.
 * These expression queries reference the last data query and build a pipeline:
 * data query -> reduce expression -> threshold expression
 */
function createExpressionQueries(
  simpleCondition: LocalSimpleCondition,
  dataQueries: AlertQuery[]
): { reduce: AlertQuery; threshold: AlertQuery; condition: string } {
  const lastDataQueryRefId = dataQueries[dataQueries.length - 1].refId;

  // Always use the same refIds for expressions to keep them stable
  const existingExpressions = dataQueries.filter((q) => q.datasourceUid === ExpressionDatasourceUID);
  const reduceRefId = existingExpressions[0]?.refId || getNextRefId(dataQueries);

  // Create a temporary query for threshold refId calculation
  const tempQueries = [
    ...dataQueries,
    {
      refId: reduceRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: { refId: reduceRefId },
    },
  ];
  const thresholdRefId = existingExpressions[1]?.refId || getNextRefId(tempQueries);

  const reduceExpression: ExpressionQuery = {
    refId: reduceRefId,
    type: ExpressionQueryType.reduce,
    datasource: { uid: ExpressionDatasourceUID, type: '__expr__' },
    reducer: simpleCondition.whenField || ReducerID.last,
    expression: lastDataQueryRefId,
  };

  const thresholdExpression: ExpressionQuery = {
    refId: thresholdRefId,
    type: ExpressionQueryType.threshold,
    datasource: { uid: ExpressionDatasourceUID, type: '__expr__' },
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

  // Expression queries don't need relativeTimeRange - they inherit time range context
  // from the data queries they reference. This is consistent with how expressions work
  // in the alerting query runner.
  return {
    reduce: {
      refId: reduceRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: reduceExpression,
    },
    threshold: {
      refId: thresholdRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: thresholdExpression,
    },
    condition: thresholdRefId,
  };
}

/**
 * Compares two AlertQuery arrays for expression-relevant equality.
 * Only compares the model content of expression queries to determine
 * if an update is actually needed.
 */
function areExpressionQueriesEqual(current: AlertQuery[], next: AlertQuery[]): boolean {
  const currentExpressions = current.filter((q) => q.datasourceUid === ExpressionDatasourceUID);
  const nextExpressions = next.filter((q) => q.datasourceUid === ExpressionDatasourceUID);

  if (currentExpressions.length !== nextExpressions.length) {
    return false;
  }

  try {
    return JSON.stringify(currentExpressions) === JSON.stringify(nextExpressions);
  } catch {
    return false;
  }
}

export function RuleConditionSection() {
  const base = useStyles2(getStyles);
  const { watch, setValue, getValues } = useFormContext<RuleFormValues>();
  const evaluateFor = watch('evaluateFor') || '0s';
  watch('folder');

  const [simpleCondition, setSimpleCondition] = useState<LocalSimpleCondition>({
    whenField: ReducerID.last,
    evaluator: { params: [0], type: EvalFunction.IsAbove },
  });

  // Track if we're currently updating to prevent infinite loops
  const isUpdatingRef = useRef(false);

  // Update expression queries whenever simpleCondition changes
  // We use a ref flag to prevent the infinite loop that would occur because:
  // simpleCondition changes -> effect runs -> setValue updates queries -> queries change -> effect would run again
  useEffect(() => {
    // Skip if we're already in an update cycle
    if (isUpdatingRef.current) {
      return;
    }

    const currentQueries = getValues('queries');
    const dataQueries = currentQueries.filter((q) => q.datasourceUid !== ExpressionDatasourceUID);

    if (dataQueries.length === 0) {
      return;
    }

    const { reduce, threshold, condition } = createExpressionQueries(simpleCondition, dataQueries);
    const newQueries = [...dataQueries, reduce, threshold];

    // Only update if the expression queries actually changed
    if (!areExpressionQueriesEqual(currentQueries, newQueries)) {
      isUpdatingRef.current = true;
      setValue('queries', newQueries, { shouldDirty: false, shouldValidate: false });
      setValue('condition', condition, { shouldDirty: false, shouldValidate: false });
      // Reset the flag after the update cycle completes
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
      });
    }
  }, [simpleCondition, getValues, setValue]);

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
