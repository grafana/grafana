import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import * as React from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, FieldValidationMessage, InlineField, MultiSelect, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { MultiValueRemove, MultiValueRemoveProps } from '@grafana/ui/src/components/Select/MultiValue';
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

const REQUIRED_FIELDS_IN_GROUPBY = ['grafana_folder', 'alertname'];

const DEFAULTS_TIMINGS = {
  groupWaitValue: TIMING_OPTIONS_DEFAULTS.group_wait,
  groupIntervalValue: TIMING_OPTIONS_DEFAULTS.group_interval,
  repeatIntervalValue: TIMING_OPTIONS_DEFAULTS.repeat_interval,
};
const DISABLE_GROUPING = '...';

export interface RoutingSettingsProps {
  alertManager: string;
}
export const RoutingSettings = ({ alertManager }: RoutingSettingsProps) => {
  const formStyles = useStyles2(getFormStyles);
  const {
    control,
    watch,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues([]));
  const { groupIntervalValue, groupWaitValue, repeatIntervalValue } = DEFAULTS_TIMINGS;
  const overrideGrouping = watch(`contactPoints.${alertManager}.overrideGrouping`);
  const overrideTimings = watch(`contactPoints.${alertManager}.overrideTimings`);
  const groupByCount = watch(`contactPoints.${alertManager}.groupBy`)?.length ?? 0;

  const styles = useStyles2(getStyles);
  useEffect(() => {
    if (overrideGrouping && groupByCount === 0) {
      setValue(`contactPoints.${alertManager}.groupBy`, REQUIRED_FIELDS_IN_GROUPBY);
    }
  }, [overrideGrouping, setValue, alertManager, groupByCount]);

  return (
    <Stack direction="column">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <InlineField label="Override grouping" transparent={true} className={styles.switchElement}>
          <Switch id="override-grouping-toggle" {...register(`contactPoints.${alertManager}.overrideGrouping`)} />
        </InlineField>
        {!overrideGrouping && (
          <Text variant="body" color="secondary">
            Grouping: <strong>{REQUIRED_FIELDS_IN_GROUPBY.join(', ')}</strong>
          </Text>
        )}
      </Stack>
      {overrideGrouping && (
        <Field
          label="Group by"
          description="Combine multiple alerts into a single notification by grouping them by the same label values. If empty, it is inherited from the default notification policy."
          {...register(`contactPoints.${alertManager}.groupBy`)}
          invalid={!!errors.contactPoints?.[alertManager]?.groupBy}
          className={styles.optionalContent}
        >
          <Controller
            rules={{
              validate: (value: string[]) => {
                if (!value || value.length === 0) {
                  return 'At least one group by option is required.';
                }
                if (value.length === 1 && value[0] === DISABLE_GROUPING) {
                  return true;
                }
                // we need to make sure that the required fields are included
                const requiredFieldsIncluded = REQUIRED_FIELDS_IN_GROUPBY.every((field) => value.includes(field));
                if (!requiredFieldsIncluded) {
                  return `Group by must include ${REQUIRED_FIELDS_IN_GROUPBY.join(', ')}`;
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
                  onChange={(value) => {
                    return onChange(mapMultiSelectValueToStrings(value));
                  }}
                  options={[...commonGroupByOptions, ...groupByOptions]}
                  components={{
                    MultiValueRemove(
                      props: React.PropsWithChildren<
                        MultiValueRemoveProps &
                          Array<SelectableValue<string>> & {
                            data: {
                              label: string;
                              value: string;
                              isFixed: boolean;
                            };
                          }
                      >
                    ) {
                      const { data } = props;
                      if (data.isFixed) {
                        return null;
                      }
                      return MultiValueRemove(props);
                    },
                  }}
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

const getStyles = (theme: GrafanaTheme2) => ({
  switchElement: css({
    flexFlow: 'row-reverse',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  optionalContent: css({
    marginLeft: '49px',
    marginBottom: theme.spacing(1),
  }),
});
