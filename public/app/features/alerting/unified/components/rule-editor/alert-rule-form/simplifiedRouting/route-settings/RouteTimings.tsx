import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { promDurationValidator, repeatIntervalValidator } from 'app/features/alerting/unified/utils/amroutes';

import { PromDurationInput } from '../../../../notification-policies/PromDurationInput';
import { getFormStyles } from '../../../../notification-policies/formStyles';
import { routeTimingsFields } from '../../../../notification-policies/routeTimingsFields';
import { TIMING_OPTIONS_DEFAULTS } from '../../../../notification-policies/timingOptions';

interface RouteTimingsProps {
  alertManager: string;
}

export function RouteTimings({ alertManager }: RouteTimingsProps) {
  const formStyles = useStyles2(getFormStyles);
  const {
    register,
    formState: { errors },
    getValues,
  } = useFormContext<RuleFormValues>();
  return (
    <>
      <Field
        label={routeTimingsFields.groupWait.label}
        description={routeTimingsFields.groupWait.description}
        invalid={!!errors.contactPoints?.[alertManager]?.groupWaitValue}
        error={errors.contactPoints?.[alertManager]?.groupWaitValue?.message}
      >
        <PromDurationInput
          {...register(`contactPoints.${alertManager}.groupWaitValue`, { validate: promDurationValidator })}
          aria-label={routeTimingsFields.groupWait.ariaLabel}
          className={formStyles.promDurationInput}
          placeholder={TIMING_OPTIONS_DEFAULTS.group_wait}
        />
      </Field>
      <Field
        label={routeTimingsFields.groupInterval.label}
        description={routeTimingsFields.groupInterval.description}
        invalid={!!errors.contactPoints?.[alertManager]?.groupIntervalValue}
        error={errors.contactPoints?.[alertManager]?.groupIntervalValue?.message}
      >
        <PromDurationInput
          {...register(`contactPoints.${alertManager}.groupIntervalValue`, {
            validate: promDurationValidator,
          })}
          aria-label={routeTimingsFields.groupInterval.ariaLabel}
          className={formStyles.promDurationInput}
          placeholder={TIMING_OPTIONS_DEFAULTS.group_interval}
        />
      </Field>
      <Field
        label={routeTimingsFields.repeatInterval.label}
        description={routeTimingsFields.repeatInterval.description}
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
          aria-label={routeTimingsFields.repeatInterval.ariaLabel}
          className={formStyles.promDurationInput}
          placeholder={TIMING_OPTIONS_DEFAULTS.repeat_interval}
        />
      </Field>
    </>
  );
}
