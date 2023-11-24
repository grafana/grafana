import React, { useState } from 'react';

import { Field, MultiSelect, Stack, Switch, useStyles2 } from '@grafana/ui';
import {
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  stringToSelectableValue,
  stringsToSelectableValues,
} from 'app/features/alerting/unified/utils/amroutes';

import { PromDurationInput } from '../../../notification-policies/PromDurationInput';
import { getFormStyles } from '../../../notification-policies/formStyles';

import { AMContactPoint } from './SimplifiedRouting';

export interface RoutingSettingsProps {
  onOverrideTimimgsChange: (value: boolean) => void;
  onOverrideGroupingChange: (value: boolean) => void;
  onChangeGrouping: (value: string[]) => void;
  alertManagerContactPoint: AMContactPoint;
}
export const RoutingSettings = ({
  onOverrideGroupingChange,
  onOverrideTimimgsChange,
  alertManagerContactPoint,
  onChangeGrouping,
}: RoutingSettingsProps) => {
  const formStyles = useStyles2(getFormStyles);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues([]));
  const { overrideGrouping, overrideTimings } = alertManagerContactPoint;

  return (
    <Stack direction="column">
      <Field label="Override grouping">
        <Switch
          id="override-grouping-toggle"
          value={overrideGrouping}
          onChange={(e) => onOverrideGroupingChange(e.currentTarget.checked)}
        />
      </Field>
      {overrideGrouping && (
        <Field
          label="Group by"
          description="Group alerts when you receive a notification based on labels. If empty it will be inherited from the default notification policy."
        >
          {/* <InputControl
            rules={{
              validate: (value) => {
                if (!value || value.length === 0) {
                  return 'At least one group by option is required.';
                }
                return true;
              },
            }} */}
          {/* render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => ( */}
          <>
            <MultiSelect
              aria-label="Group by"
              // {...field}
              // invalid={Boolean(error)}
              value={stringsToSelectableValues(alertManagerContactPoint.groupBy)}
              allowCustomValue
              className={formStyles.input}
              onCreateOption={(opt: string) => {
                setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);
                onChangeGrouping([...(alertManagerContactPoint?.groupBy ?? []), opt]);
              }}
              onChange={(value) => onChangeGrouping(mapMultiSelectValueToStrings(value))}
              options={[...commonGroupByOptions, ...groupByOptions]}
            />
            {/* {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>} */}
          </>
          {/* )} */}
          {/* name="groupBy"
          control={control} */}
          {/* /> */}
        </Field>
      )}
      <Field label="Override timings">
        <Switch
          id="override-timings-toggle"
          value={overrideTimings}
          onChange={(e) => onOverrideTimimgsChange(e.currentTarget.checked)}
        />
      </Field>
      {overrideTimings && (
        <>
          <Field
            label="Group wait"
            description="The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy."
            // invalid={!!errors.groupWaitValue}
            // error={errors.groupWaitValue?.message}
          >
            <PromDurationInput
              // {...register('groupWaitValue', { validate: promDurationValidator })}
              aria-label="Group wait value"
              className={formStyles.promDurationInput}
            />
          </Field>
          <Field
            label="Group interval"
            description="The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy."
            // invalid={!!errors.groupIntervalValue}
            // error={errors.groupIntervalValue?.message}
          >
            <PromDurationInput
              // {...register('groupIntervalValue', { validate: promDurationValidator })}
              aria-label="Group interval value"
              className={formStyles.promDurationInput}
            />
          </Field>
          <Field
            label="Repeat interval"
            description="The waiting time to resend an alert after they have successfully been sent."
            // invalid={!!errors.repeatIntervalValue}
            // error={errors.repeatIntervalValue?.message}
          >
            <PromDurationInput
              // {...register('repeatIntervalValue', {
              //   validate: (value: string) => {
              //     const groupInterval = getValues('groupIntervalValue');
              //     return repeatIntervalValidator(value, groupInterval);
              //   },
              // })}
              aria-label="Repeat interval value"
              className={formStyles.promDurationInput}
            />
          </Field>
        </>
      )}
    </Stack>
  );
};
