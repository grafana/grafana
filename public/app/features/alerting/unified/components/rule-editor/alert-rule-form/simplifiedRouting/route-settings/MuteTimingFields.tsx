import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, InputControl, MultiSelect, useStyles2 } from '@grafana/ui';
import { useMuteTimingOptions } from 'app/features/alerting/unified/hooks/useMuteTimingOptions';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { mapMultiSelectValueToStrings } from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../../notification-policies/formStyles';

export interface MuteTimingFieldsProps {
  alertManager: string;
}

export function MuteTimingFields({ alertManager }: MuteTimingFieldsProps) {
  const styles = useStyles2(getFormStyles);
  const {
    control,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const muteTimingOptions = useMuteTimingOptions();
  return (
    <Field
      label="Mute timings"
      data-testid="am-mute-timing-select"
      description="Select a mute timing to define when not to send notifications for this alert rule"
      invalid={!!errors.contactPoints?.[alertManager]?.muteTimeIntervals}
    >
      <InputControl
        render={({ field: { onChange, ref, ...field } }) => (
          <MultiSelect
            aria-label="Mute timings"
            {...field}
            className={styles.input}
            onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
            options={muteTimingOptions}
            placeholder="Select mute timings..."
          />
        )}
        control={control}
        name={`contactPoints.${alertManager}.muteTimeIntervals`}
      />
    </Field>
  );
}
