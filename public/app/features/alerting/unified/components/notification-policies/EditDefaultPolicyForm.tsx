import { ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Collapse, Field, Link, MultiSelect, useStyles2 } from '@grafana/ui';
import { ContactPointSelector } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';
import { handleContactPointSelect } from 'app/features/alerting/unified/components/notification-policies/utils';
import { RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import {
  amRouteToFormAmRoute,
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  promDurationValidator,
  repeatIntervalValidator,
  stringToSelectableValue,
  stringsToSelectableValues,
} from '../../utils/amroutes';
import { makeAMLink } from '../../utils/misc';

import { PromDurationInput } from './PromDurationInput';
import { getFormStyles } from './formStyles';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';

export interface AmRootRouteFormProps {
  alertManagerSourceName: string;
  actionButtons: ReactNode;
  onSubmit: (route: Partial<FormAmRoute>) => void;
  route: RouteWithID;
}

export const AmRootRouteForm = ({ actionButtons, alertManagerSourceName, onSubmit, route }: AmRootRouteFormProps) => {
  const styles = useStyles2(getFormStyles);
  const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route.group_by));

  const defaultValues = amRouteToFormAmRoute(route);
  const {
    handleSubmit,
    register,
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<FormAmRoute>({
    defaultValues: {
      ...defaultValues,
      overrideTimings: true,
      overrideGrouping: true,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field label="Default contact point" invalid={!!errors.receiver} error={errors.receiver?.message}>
        <>
          <div className={styles.container} data-testid="am-receiver-select">
            <Controller
              render={({ field: { onChange, ref, value, ...field } }) => (
                <ContactPointSelector
                  selectProps={{
                    ...field,
                    onChange: (changeValue) => handleContactPointSelect(changeValue, onChange),
                  }}
                  selectedContactPointName={value}
                />
              )}
              control={control}
              name="receiver"
              rules={{ required: { value: true, message: 'Required.' } }}
            />
            <span>or</span>
            <Link
              className={styles.linkText}
              href={makeAMLink('/alerting/notifications/receivers/new', alertManagerSourceName)}
            >
              Create a contact point
            </Link>
          </div>
        </>
      </Field>
      <Field
        label="Group by"
        description="Combine multiple alerts into a single notification by grouping them by the same label values."
        data-testid="am-group-select"
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <MultiSelect
              aria-label="Group by"
              {...field}
              allowCustomValue
              className={styles.input}
              onCreateOption={(opt: string) => {
                setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);
                setValue('groupBy', [...(field.value || []), opt]);
              }}
              onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
              options={[...commonGroupByOptions, ...groupByOptions]}
            />
          )}
          control={control}
          name="groupBy"
        />
      </Field>
      <Collapse
        collapsible
        className={styles.collapse}
        isOpen={isTimingOptionsExpanded}
        label="Timing options"
        onToggle={setIsTimingOptionsExpanded}
      >
        <div className={styles.timingFormContainer}>
          <Field
            label="Group wait"
            description="The waiting time before sending the first notification for a new group of alerts. Default 30 seconds."
            invalid={!!errors.groupWaitValue}
            error={errors.groupWaitValue?.message}
            data-testid="am-group-wait"
          >
            <PromDurationInput
              {...register('groupWaitValue', { validate: promDurationValidator })}
              placeholder={TIMING_OPTIONS_DEFAULTS.group_wait}
              className={styles.promDurationInput}
              aria-label="Group wait"
            />
          </Field>
          <Field
            label="Group interval"
            description="The wait time before sending a notification about changes in the alert group after the first notification has been sent. Default is 5 minutes."
            invalid={!!errors.groupIntervalValue}
            error={errors.groupIntervalValue?.message}
            data-testid="am-group-interval"
          >
            <PromDurationInput
              {...register('groupIntervalValue', { validate: promDurationValidator })}
              placeholder={TIMING_OPTIONS_DEFAULTS.group_interval}
              className={styles.promDurationInput}
              aria-label="Group interval"
            />
          </Field>
          <Field
            label="Repeat interval"
            description="The wait time before resending a notification that has already been sent successfully. Default is 4 hours. Should be a multiple of Group interval."
            invalid={!!errors.repeatIntervalValue}
            error={errors.repeatIntervalValue?.message}
            data-testid="am-repeat-interval"
          >
            <PromDurationInput
              {...register('repeatIntervalValue', {
                validate: (value: string) => {
                  const groupInterval = getValues('groupIntervalValue');
                  return repeatIntervalValidator(value, groupInterval);
                },
              })}
              placeholder={TIMING_OPTIONS_DEFAULTS.repeat_interval}
              className={styles.promDurationInput}
              aria-label="Repeat interval"
            />
          </Field>
        </div>
      </Collapse>
      <div className={styles.container}>{actionButtons}</div>
    </form>
  );
};
