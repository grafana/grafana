import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AnyAction } from 'redux';

import { Field, FieldValidationMessage, InputControl, MultiSelect, Stack, Switch, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import {
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  stringToSelectableValue,
  stringsToSelectableValues,
} from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../notification-policies/formStyles';

export interface RoutingSettingsProps {
  dispatch: React.Dispatch<AnyAction>;
  alertManagerName: string;
}
export const RoutingSettings = ({ dispatch, alertManagerName }: RoutingSettingsProps) => {
  const formStyles = useStyles2(getFormStyles);
  const { control, watch, setValue } = useFormContext<RuleFormValues>();
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues([])); //todo this array?

  function onOverrideGroupingChange(e: React.FormEvent<HTMLInputElement>) {
    setValue('overrideGrouping', e.currentTarget.checked);
  }
  return (
    <Stack direction="column">
      {/* <Field label="Override general timings">
               <Switch id="override-timings-toggle" {...register('overrideTimings')} />
           </Field>
           {watch().overrideTimings && (
               <>
                   <Field
                       label="Group wait"
                       description="The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy."
                       invalid={!!errors.groupWaitValue}
                       error={errors.groupWaitValue?.message}
                   >
                       <PromDurationInput
                           {...register('groupWaitValue', { validate: promDurationValidator })}
                           aria-label="Group wait value"
                           className={formStyles.promDurationInput}
                       />
                   </Field>
                   <Field
                       label="Group interval"
                       description="The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy."
                       invalid={!!errors.groupIntervalValue}
                       error={errors.groupIntervalValue?.message}
                   >
                       <PromDurationInput
                           {...register('groupIntervalValue', { validate: promDurationValidator })}
                           aria-label="Group interval value"
                           className={formStyles.promDurationInput}
                       />
                   </Field>
                   <Field
                       label="Repeat interval"
                       description="The waiting time to resend an alert after they have successfully been sent."
                       invalid={!!errors.repeatIntervalValue}
                       error={errors.repeatIntervalValue?.message}
                   >
                       <PromDurationInput
                           {...register('repeatIntervalValue', {
                               validate: (value: string) => {
                                   const groupInterval = getValues('groupIntervalValue');
                                   return repeatIntervalValidator(value, groupInterval);
                               },
                           })}
                           aria-label="Repeat interval value"
                           className={formStyles.promDurationInput}
                       />
                   </Field>
               </>
           )} */}
      <Field label="Override grouping">
        <Switch id="override-grouping-toggle" value={watch('overrideGrouping')} onChange={onOverrideGroupingChange} />
      </Field>
      {watch('overrideGrouping') && (
        <Field
          label="Group by"
          description="Group alerts when you receive a notification based on labels. If empty it will be inherited from the parent policy."
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
                    setValue('groupBy', [...field.value, opt]);
                  }}
                  onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                  options={[...commonGroupByOptions, ...groupByOptions]}
                />
                {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
              </>
            )}
            name="groupBy"
            control={control}
          />
        </Field>
      )}
    </Stack>
  );
};

// function onCallFirst(receiver: AmRouteReceiver) {
//     if (receiver.grafanaAppReceiverType === SupportedPlugin.OnCall) {
//         return -1;
//     } else {
//         return 0;
//     }
// }

// const getStyles = (theme: GrafanaTheme2) => {
//     const commonSpacing = theme.spacing(3.5);

//     return {
//         addMatcherBtn: css`
//       margin-bottom: ${commonSpacing};
//     `,
//         matchersContainer: css`
//       background-color: ${theme.colors.background.secondary};
//       padding: ${theme.spacing(1.5)} ${theme.spacing(2)};
//       padding-bottom: 0;
//       width: fit-content;
//     `,
//         matchersOperator: css`
//       min-width: 120px;
//     `,
//         noMatchersWarning: css`
//       padding: ${theme.spacing(1)} ${theme.spacing(2)};
//     `,
//     };
// };
