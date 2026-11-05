import { useFormContext } from 'react-hook-form';

import {
  type RoutingTimingError,
  type RoutingTimings,
  getRoutingTimingErrors,
  useInheritedRoutingTimings,
} from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Field, useStyles2 } from '@grafana/ui';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { PromDurationInput } from '../../../../notification-policies/PromDurationInput';
import { getFormStyles } from '../../../../notification-policies/formStyles';
import { routeTimingsFields } from '../../../../notification-policies/routeTimingsFields';

interface RouteTimingsProps {
  alertManager: string;
}

function getTimingErrorMessage(error: RoutingTimingError) {
  return error === 'zero'
    ? t('alerting.route-timings.error-zero', 'Must be greater than zero')
    : t('alerting.route-timings.error-format', 'Invalid duration format. Must be {number}{time_unit}');
}

const validateTiming = (field: keyof RoutingTimings) => (value: string) => {
  const error = getRoutingTimingErrors({ [field]: value })[field];
  return error ? getTimingErrorMessage(error) : true;
};

export function RouteTimings({ alertManager }: RouteTimingsProps) {
  const formStyles = useStyles2(getFormStyles);
  const {
    register,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const { timings: inherited } = useInheritedRoutingTimings();

  return (
    <>
      <Field
        label={routeTimingsFields.groupWait.label}
        description={routeTimingsFields.groupWait.description}
        invalid={!!errors.contactPoints?.[alertManager]?.groupWaitValue}
        error={errors.contactPoints?.[alertManager]?.groupWaitValue?.message}
      >
        <PromDurationInput
          {...register(`contactPoints.${alertManager}.groupWaitValue`, { validate: validateTiming('groupWait') })}
          aria-label={routeTimingsFields.groupWait.ariaLabel}
          className={formStyles.promDurationInput}
          placeholder={inherited.groupWait}
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
            validate: validateTiming('groupInterval'),
          })}
          aria-label={routeTimingsFields.groupInterval.ariaLabel}
          className={formStyles.promDurationInput}
          placeholder={inherited.groupInterval}
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
            validate: validateTiming('repeatInterval'),
          })}
          aria-label={routeTimingsFields.repeatInterval.ariaLabel}
          className={formStyles.promDurationInput}
          placeholder={inherited.repeatInterval}
        />
      </Field>
    </>
  );
}
