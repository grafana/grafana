import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { promDurationValidator, repeatIntervalValidator } from 'app/features/alerting/unified/utils/amroutes';

import { PromDurationInput } from '../../../../notification-policies/PromDurationInput';
import { getFormStyles } from '../../../../notification-policies/formStyles';
import { TIMING_OPTIONS_DEFAULTS } from '../../../../notification-policies/timingOptions';

interface RouteTimmingsProps {
  alertManager: string;
}

export function RouteTimmings({ alertManager }: RouteTimmingsProps) {
  const formStyles = useStyles2(getFormStyles);
  const {
    register,
    formState: { errors },
    getValues,
  } = useFormContext<RuleFormValues>();
  return (
    <>
      <Field
        label="Group wait"
        description="The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy."
        invalid={!!errors.contactPoints?.[alertManager]?.groupWaitValue}
        error={errors.contactPoints?.[alertManager]?.groupWaitValue?.message}
      >
        <PromDurationInput
          {...register(`contactPoints.${alertManager}.groupWaitValue`, { validate: promDurationValidator })}
          aria-label="Group wait value"
          className={formStyles.promDurationInput}
          placeholder={TIMING_OPTIONS_DEFAULTS.group_wait}
        />
      </Field>
      <Field
        label="Group interval"
        description="The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy."
        invalid={!!errors.contactPoints?.[alertManager]?.groupIntervalValue}
        error={errors.contactPoints?.[alertManager]?.groupIntervalValue?.message}
      >
        <PromDurationInput
          {...register(`contactPoints.${alertManager}.groupIntervalValue`, {
            validate: promDurationValidator,
          })}
          aria-label="Group interval value"
          className={formStyles.promDurationInput}
          placeholder={TIMING_OPTIONS_DEFAULTS.group_interval}
        />
      </Field>
      <Field
        label="Repeat interval"
        description="The waiting time to resend an alert after they have successfully been sent."
        invalid={!!errors.contactPoints?.[alertManager]?.repeatIntervalValue}
        error={errors.contactPoints?.[alertManager]?.repeatIntervalValue?.message}
      >
        <PromDurationInput
          {...register(`contactPoints.${alertManager}.repeatIntervalValue`, {
            validate: (value: string) => {
              const groupInterval = getValues(`contactPoints.${alertManager}.repeatIntervalValue`);
              return repeatIntervalValidator(value, groupInterval);
            },
          })}
          aria-label="Repeat interval value"
          className={formStyles.promDurationInput}
          placeholder={TIMING_OPTIONS_DEFAULTS.repeat_interval}
        />
      </Field>
    </>
  );
}
