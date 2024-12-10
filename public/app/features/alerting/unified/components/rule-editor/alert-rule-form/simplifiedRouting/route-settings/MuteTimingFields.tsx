import { Controller, useFormContext } from 'react-hook-form';

import { Field } from '@grafana/ui';
import MuteTimingsSelector from 'app/features/alerting/unified/components/alertmanager-entities/MuteTimingsSelector';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { mapMultiSelectValueToStrings } from 'app/features/alerting/unified/utils/amroutes';

/** Provides a form field for use in simplified routing, for selecting appropriate mute timings */
export function MuteTimingFields({ alertmanager }: BaseAlertmanagerArgs) {
  const {
    control,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  return (
    <Field
      label="Mute timings"
      data-testid="am-mute-timing-select"
      description="Select a mute timing to define when not to send notifications for this alert rule"
      invalid={!!errors.contactPoints?.[alertmanager]?.muteTimeIntervals}
    >
      <Controller
        render={({ field: { onChange, ref, ...field } }) => (
          <MuteTimingsSelector
            alertmanager={alertmanager}
            selectProps={{
              ...field,
              onChange: (value) => onChange(mapMultiSelectValueToStrings(value)),
            }}
          />
        )}
        control={control}
        name={`contactPoints.${alertmanager}.muteTimeIntervals`}
      />
    </Field>
  );
}
