import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { PanelData } from '@grafana/data';
import { Field, InputControl } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { ExpressionEditor } from '../ExpressionEditor';
import { QueryEditor } from '../QueryEditor';

interface Props {
  panelData: Record<string, PanelData>;
  queries: AlertQuery[];
  condition: string | null;
  onSetCondition: (refId: string) => void;
  onChangeQueries: (queries: AlertQuery[]) => void;
}

export const Query: FC<Props> = ({ queries, panelData, onChangeQueries, condition, onSetCondition }) => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

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
        <QueryEditor
          queries={queries}
          onChangeQueries={onChangeQueries}
          panelData={panelData}
          condition={condition}
          onSetCondition={onSetCondition}
        />
      )}
    </div>
  );
};
