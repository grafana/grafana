import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Combobox,
  ComboboxOption,
  Field,
  Icon,
  InlineField,
  InlineFieldRow,
  Input,
  Select,
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
import { safeParsePrometheusDuration } from '../utils/time';

import { getPendingPeriodQuickOptions } from './rule-editor/DurationQuickPick';

export function RuleConditionSection({ type }: { type: RuleFormType }) {
  const base = useStyles2(getStyles);
  const { register, watch, setValue } = useFormContext<RuleFormValues>();
  const evaluateEvery = watch('evaluateEvery') || '5m';
  const evaluateFor = watch('evaluateFor') || '0s';
  const pendingOptions = getPendingPeriodQuickOptions(evaluateEvery);
  const [customMode, setCustomMode] = useState(false);
  const isCustomSelected = customMode;
  const customDelay = isCustomSelected ? evaluateFor : '';
  const evalMs = safeParsePrometheusDuration(evaluateEvery);
  const customMs = safeParsePrometheusDuration(customDelay || '0s');
  const isCustomInvalid = isCustomSelected && (evalMs <= 0 || customMs <= 0 || customMs % evalMs !== 0);

  let fireSelectLabel: string = evaluateFor;
  if (isCustomSelected) {
    fireSelectLabel = customDelay || pendingOptions[1] || '1m';
  } else if (evaluateFor === '0s') {
    fireSelectLabel = t('alerting.duration.immediately', 'immediately');
  }

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

          <div className={base.paragraphRow}>
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.every">Evaluate the rule every</Trans>
            </Text>
            <Input width={8} {...register('evaluateEvery')} />
            <Text>.</Text>
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.wait-prefix">Wait</Trans>
            </Text>
            <Input width={8} value={evaluateFor} onChange={(e) => setValue('evaluateFor', e.currentTarget.value)} />
            {isCustomSelected && (
              <Field
                noMargin
                className={base.inlineField}
                invalid={isCustomInvalid || undefined}
                error={
                  isCustomInvalid
                    ? t(
                        'alerting.simplified.evaluation.custom-delay-invalid',
                        'The delay must be a multiple of the evaluation frequency.'
                      )
                    : undefined
                }
              >
                <Input width={8} value={customDelay} onChange={(e) => setValue('evaluateFor', e.currentTarget.value)} />
              </Field>
            )}
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.wait-suffix">
                after the condition is breached before firing.
              </Trans>
            </Text>
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.fire">Fire the alert rule</Trans>
            </Text>
            <Select
              width={20}
              value={{
                value: isCustomSelected ? 'custom' : evaluateFor,
                label: fireSelectLabel,
              }}
              onChange={(v: SelectableValue<string>) => {
                const val = v?.value;
                if (val === 'custom') {
                  setCustomMode(true);
                  const defCustom = pendingOptions[1] || evaluateEvery || '1m';
                  if (!evaluateFor || pendingOptions.includes(evaluateFor)) {
                    setValue('evaluateFor', defCustom);
                  }
                  return;
                }
                setCustomMode(false);
                setValue('evaluateFor', val || '0s');
              }}
              options={[
                { value: '0s', label: t('alerting.duration.immediately', 'immediately') },
                ...pendingOptions.filter((d) => d !== '0s').map((d) => ({ value: d, label: d })),
                { value: 'custom', label: t('alerting.simplified.evaluation.custom-delay', 'with custom delay of') },
              ]}
            />
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.after-breached">
                after the condition is initially breached.
              </Trans>
            </Text>
          </div>

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
