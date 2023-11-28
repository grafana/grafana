import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, FieldValidationMessage, InputControl, MultiSelect, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import {
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  promDurationValidator,
  repeatIntervalValidator,
  stringToSelectableValue,
  stringsToSelectableValues,
} from 'app/features/alerting/unified/utils/amroutes';

import { PromDurationInput } from '../../../notification-policies/PromDurationInput';
import { getFormStyles } from '../../../notification-policies/formStyles';
import { TIMING_OPTIONS_DEFAULTS } from '../../../notification-policies/timingOptions';

export interface RoutingSettingsProps {
  alertManager: string;
}
export const RoutingSettings = ({ alertManager }: RoutingSettingsProps) => {
  const formStyles = useStyles2(getFormStyles);
  const {
    control,
    watch,
    register,
    formState: { errors },
    getValues,
  } = useFormContext<RuleFormValues>();
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues([]));
  const { groupBy, groupIntervalValue, groupWaitValue, repeatIntervalValue } = useGetDefaultsForRoutingSettings();

  return (
    <Stack direction="column">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Field label="Override grouping">
          <Switch id="override-grouping-toggle" {...register(`contactPoints.${alertManager}.overrideGrouping`)} />
        </Field>
        {!watch(`contactPoints.${alertManager}.overrideGrouping`) && (
          <Text variant="body" color="secondary">
            Grouping: <strong>{groupBy.join(', ')}</strong>
          </Text>
        )}
      </Stack>
      {watch(`contactPoints.${alertManager}.overrideGrouping`) && (
        <Field
          label="Group by"
          description="Group alerts when you receive a notification based on labels. If empty it will be inherited from the default notification policy."
        >
          <InputControl
            rules={{
              validate: (value) => {
                if (!value || value.length === 0) {
                  return 'At least one group by option is required.';
                }
                return true;
              },
            }}
            render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
              <>
                <MultiSelect
                  aria-label="Group by"
                  {...field}
                  invalid={Boolean(error)}
                  allowCustomValue
                  className={formStyles.input}
                  onCreateOption={(opt: string) => {
                    setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                    // @ts-ignore-check: react-hook-form made me do this
                    setValue(`contactPoints.${contactPointIndex}.groupBy`, [...field.value, opt]);
                  }}
                  onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                  options={[...commonGroupByOptions, ...groupByOptions]}
                />
                {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
              </>
            )}
            name={`contactPoints.${alertManager}.groupBy`}
            control={control}
          />
        </Field>
      )}
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Field label="Override timings">
          <Switch id="override-timings-toggle" {...register(`contactPoints.${alertManager}.overrideTimings`)} />
        </Field>
        {!watch(`contactPoints.${alertManager}.overrideTimings`) && (
          <Text variant="body" color="secondary">
            Group wait: <strong>{groupWaitValue}, </strong>
            Group interval: <strong>{groupIntervalValue}, </strong>
            Repeat interval: <strong>{repeatIntervalValue}</strong>
          </Text>
        )}
      </Stack>
      {watch(`contactPoints.${alertManager}.overrideTimings`) && (
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
            />
          </Field>
        </>
      )}
    </Stack>
  );
};

function useGetDefaultsForRoutingSettings() {
  const { selectedAlertmanager } = useAlertmanager();
  const { currentData } = useAlertmanagerConfig(selectedAlertmanager);
  const config = currentData?.alertmanager_config;
  return React.useMemo(() => {
    return {
      groupWaitValue: TIMING_OPTIONS_DEFAULTS.group_wait,
      groupIntervalValue: TIMING_OPTIONS_DEFAULTS.group_interval,
      repeatIntervalValue: TIMING_OPTIONS_DEFAULTS.repeat_interval,
      groupBy: config?.route?.group_by ?? [],
    };
  }, [config]);
}
