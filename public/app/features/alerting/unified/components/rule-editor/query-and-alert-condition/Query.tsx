import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, InputControl } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { ExpressionEditor } from '../ExpressionEditor';
import { QueryEditor } from '../QueryEditor';

export const Query: FC = () => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const [type, dataSourceName] = watch(['type', 'dataSourceName']);

  const isGrafanaManagedType = type === RuleFormType.grafana;
  const isCloudAlertRuleType = type === RuleFormType.cloudAlerting;
  const isRecordingRuleType = type === RuleFormType.cloudRecording;

  const showCloudExpressionEditor = (isRecordingRuleType || isCloudAlertRuleType) && dataSourceName;

  return (
    <div>
      {/* This is the PromQL Editor for Cloud rules and recording rules */}
      {showCloudExpressionEditor && (
        <Field error={errors.expression?.message} invalid={!!errors.expression?.message}>
          <InputControl
            name="expression"
            render={({ field: { ref, ...field } }) => {
              return <ExpressionEditor {...field} dataSourceName={dataSourceName} />;
            }}
            control={control}
            rules={{
              required: { value: true, message: 'A valid expression is required' },
            }}
          />
        </Field>
      )}

      {/* This is the editor for Grafana managed rules */}
      {isGrafanaManagedType && (
        <Field
          invalid={!!errors.queries}
          error={(!!errors.queries && 'Must provide at least one valid query.') || undefined}
        >
          <InputControl
            name="queries"
            render={({ field: { ref, ...field } }) => <QueryEditor {...field} />}
            control={control}
            rules={{
              validate: (queries) => Array.isArray(queries) && !!queries.length,
            }}
          />
        </Field>
      )}
    </div>
  );
};
