import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
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

// Helper function to create expression queries from simple condition
function createExpressionQueries(
  simpleCondition: LocalSimpleCondition,
  dataQueries: AlertQuery[]
): { reduce: AlertQuery; threshold: AlertQuery; condition: string } {
  const lastDataQueryRefId = dataQueries[dataQueries.length - 1].refId;

  // Always use the same refIds for expressions to keep them stable
  const existingExpressions = dataQueries.filter((q) => q.datasourceUid === ExpressionDatasourceUID);
  const reduceRefId = existingExpressions[0]?.refId || getNextRefId(dataQueries);

  // Create a temporary query for threshold refId calculation
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const tempQueries = [
    ...dataQueries,
    {
      refId: reduceRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: { refId: reduceRefId },
    } as AlertQuery,
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

export function RuleConditionSection() {
  const base = useStyles2(getStyles);
  const { watch, setValue } = useFormContext<RuleFormValues>();
  const evaluateFor = watch('evaluateFor') || '0s';
  const queries = watch('queries');
  watch('folder');

  const [simpleCondition, setSimpleCondition] = useState<LocalSimpleCondition>({
    whenField: ReducerID.last,
    evaluator: { params: [0], type: EvalFunction.IsAbove },
  });

  // Update expression queries whenever simpleCondition changes
  useEffect(() => {
    const dataQueries = queries.filter((q) => q.datasourceUid !== ExpressionDatasourceUID);
    if (dataQueries.length === 0) {
      return;
    }

    const { reduce, threshold, condition } = createExpressionQueries(simpleCondition, dataQueries);

    setValue('queries', [...dataQueries, reduce, threshold], { shouldDirty: false, shouldValidate: false });
    setValue('condition', condition, { shouldDirty: false, shouldValidate: false });
  }, [simpleCondition, queries, setValue]);

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
        <div className={base.sectionHeader}>
          {`2. `}
          <Trans i18nKey="alerting.simplified.condition.title">Condition</Trans>
        </div>
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
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
    paragraphRow: css({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(1) }),
    inlineField: css({ display: 'inline-flex' }),
  };
}
