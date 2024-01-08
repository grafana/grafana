import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, FieldValidationMessage, InputControl, MultiSelect, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import {
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  stringToSelectableValue,
  stringsToSelectableValues,
} from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../../notification-policies/formStyles';
import { TIMING_OPTIONS_DEFAULTS } from '../../../../notification-policies/timingOptions';

import { RouteTimings } from './RouteTimings';

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
  } = useFormContext<RuleFormValues>();
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues([]));
  const { groupBy, groupIntervalValue, groupWaitValue, repeatIntervalValue } = useGetDefaultsForRoutingSettings();
  const overrideGrouping = watch(`contactPoints.${alertManager}.overrideGrouping`);
  const overrideTimings = watch(`contactPoints.${alertManager}.overrideTimings`);
  return (
    <Stack direction="column">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Field label="Override grouping">
          <Switch id="override-grouping-toggle" {...register(`contactPoints.${alertManager}.overrideGrouping`)} />
        </Field>
        {!overrideGrouping && (
          <Text variant="body" color="secondary">
            Grouping: <strong>{groupBy.join(', ')}</strong>
          </Text>
        )}
      </Stack>
      {overrideGrouping && (
        <Field
          label="Group by"
          description="Group alerts when you receive a notification based on labels. If empty it will be inherited from the default notification policy."
          {...register(`contactPoints.${alertManager}.groupBy`, { required: true })}
          invalid={!!errors.contactPoints?.[alertManager]?.groupBy}
        >
          <InputControl
            render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
              <>
                <MultiSelect
                  aria-label="Group by"
                  {...field}
                  allowCustomValue
                  className={formStyles.input}
                  onCreateOption={(opt: string) => {
                    setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                    // @ts-ignore-check: react-hook-form made me do this
                    setValue(`contactPoints.${alertManager}.groupBy`, [...field.value, opt]);
                  }}
                  onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                  options={[...commonGroupByOptions, ...groupByOptions]}
                />
                {error && <FieldValidationMessage>{'At least one group by option is required'}</FieldValidationMessage>}
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
        {!overrideTimings && (
          <Text variant="body" color="secondary">
            Group wait: <strong>{groupWaitValue}, </strong>
            Group interval: <strong>{groupIntervalValue}, </strong>
            Repeat interval: <strong>{repeatIntervalValue}</strong>
          </Text>
        )}
      </Stack>
      {overrideTimings && <RouteTimings alertManager={alertManager} />}
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
