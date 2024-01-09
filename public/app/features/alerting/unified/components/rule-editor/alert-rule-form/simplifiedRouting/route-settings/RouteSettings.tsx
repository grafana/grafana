import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Field,
  FieldValidationMessage,
  InlineField,
  InputControl,
  MultiSelect,
  Stack,
  Switch,
  Text,
  useStyles2,
} from '@grafana/ui';
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
  const requiredFieldsInGroupBy = ['grafana_folder', 'alertname'];
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <InlineField label="Override grouping" transparent={true} className={styles.switchElement}>
          <Switch id="override-grouping-toggle" {...register(`contactPoints.${alertManager}.overrideGrouping`)} />
        </InlineField>
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
          className={styles.optionalContent}
        >
          <InputControl
            rules={{
              validate: (value: string[]) => {
                if (!value || value.length === 0) {
                  return 'At least one group by option is required.';
                }
                // we need to make sure that the required fields are included
                const requiredFieldsIncluded = requiredFieldsInGroupBy.every((field) => value.includes(field));
                if (!requiredFieldsIncluded) {
                  return `Group by must include ${requiredFieldsInGroupBy.join(', ')}`;
                }
                return true;
              },
            }}
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
                {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
              </>
            )}
            name={`contactPoints.${alertManager}.groupBy`}
            control={control}
          />
        </Field>
      )}
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <InlineField label="Override timings" transparent={true} className={styles.switchElement}>
          <Switch id="override-timings-toggle" {...register(`contactPoints.${alertManager}.overrideTimings`)} />
        </InlineField>
        {!overrideTimings && (
          <Text variant="body" color="secondary">
            Group wait: <strong>{groupWaitValue}, </strong>
            Group interval: <strong>{groupIntervalValue}, </strong>
            Repeat interval: <strong>{repeatIntervalValue}</strong>
          </Text>
        )}
      </Stack>
      {overrideTimings && (
        <div className={styles.optionalContent}>
          <RouteTimings alertManager={alertManager} />
        </div>
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

const getStyles = (theme: GrafanaTheme2) => ({
  switchElement: css({
    flexFlow: 'row-reverse',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  optionalContent: css({
    marginLeft: '49px',
  }),
});
