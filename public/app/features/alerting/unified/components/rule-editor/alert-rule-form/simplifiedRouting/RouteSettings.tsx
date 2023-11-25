import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, FieldValidationMessage, InputControl, MultiSelect, Stack, Switch, useStyles2 } from '@grafana/ui';
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

export interface RoutingSettingsProps {
  contactPointIndex: number;
}
export const RoutingSettings = ({ contactPointIndex }: RoutingSettingsProps) => {
  const formStyles = useStyles2(getFormStyles);
  const {
    control,
    watch,
    register,
    formState: { errors },
    getValues,
  } = useFormContext<RuleFormValues>();
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues([]));

  return (
    <Stack direction="column">
      <Field label="Override grouping">
        <Switch id="override-grouping-toggle" {...register(`contactPoints.${contactPointIndex}.overrideGrouping`)} />
      </Field>
      {watch(`contactPoints.${contactPointIndex}.overrideGrouping`) && (
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

                  // value={stringsToSelectableValues(groupBy)}
                  // allowCustomValue
                  // className={formStyles.input}
                  // onCreateOption={(opt: string) => {
                  //   setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);
                  //   onChangeGrouping([...(groupBy ?? []), opt]);
                  // }}
                  // onChange={(value) => onChangeGrouping(mapMultiSelectValueToStrings(value))}
                  // options={[...commonGroupByOptions, ...groupByOptions]}
                />
                {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
              </>
            )}
            name={`contactPoints.${contactPointIndex}.groupBy`}
            control={control}
          />
        </Field>
      )}
      <Field label="Override timings">
        <Switch id="override-timings-toggle" {...register(`contactPoints.${contactPointIndex}.overrideTimings`)} />
      </Field>
      {watch(`contactPoints.${contactPointIndex}.overrideTimings`) && (
        <>
          <Field
            label="Group wait"
            description="The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy."
            invalid={!!errors.contactPoints?.[contactPointIndex]?.groupWaitValue}
            error={errors.contactPoints?.[contactPointIndex]?.groupWaitValue?.message}
          >
            <PromDurationInput
              {...register(`contactPoints.${contactPointIndex}.groupWaitValue`, { validate: promDurationValidator })}
              aria-label="Group wait value"
              className={formStyles.promDurationInput}
            />
          </Field>
          <Field
            label="Group interval"
            description="The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy."
            invalid={!!errors.contactPoints?.[contactPointIndex]?.groupIntervalValue}
            error={errors.contactPoints?.[contactPointIndex]?.groupIntervalValue?.message}
          >
            <PromDurationInput
              {...register(`contactPoints.${contactPointIndex}.groupIntervalValue`, {
                validate: promDurationValidator,
              })}
              aria-label="Group interval value"
              className={formStyles.promDurationInput}
            />
          </Field>
          <Field
            label="Repeat interval"
            description="The waiting time to resend an alert after they have successfully been sent."
            invalid={!!errors.contactPoints?.[contactPointIndex]?.repeatIntervalValue}
            error={errors.contactPoints?.[contactPointIndex]?.repeatIntervalValue?.message}
          >
            <PromDurationInput
              {...register(`contactPoints.${contactPointIndex}.repeatIntervalValue`, {
                validate: (value: string) => {
                  const groupInterval = getValues(`contactPoints.${contactPointIndex}.repeatIntervalValue`);
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
