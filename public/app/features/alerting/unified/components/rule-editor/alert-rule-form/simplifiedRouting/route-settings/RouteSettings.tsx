import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { DISABLE_GROUPING, getDefaultGroupByLabels, nextGroupBy } from '@grafana/alerting/unstable';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, FieldValidationMessage, InlineField, MultiSelect, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import {
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  stringToSelectableValue,
  stringsToSelectableValues,
} from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../../notification-policies/formStyles';
import { TIMING_OPTIONS_DEFAULTS } from '../../../../notification-policies/timingOptions';

import { RouteTimings } from './RouteTimings';

const DEFAULTS_TIMINGS = {
  groupWaitValue: TIMING_OPTIONS_DEFAULTS.group_wait,
  groupIntervalValue: TIMING_OPTIONS_DEFAULTS.group_interval,
  repeatIntervalValue: TIMING_OPTIONS_DEFAULTS.repeat_interval,
};

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
  const groupBy = watch(`contactPoints.${alertManager}.groupBy`);

  const styles = useStyles2(getStyles);

  // Set default groupBy values when override grouping is enabled and field is empty
  useEffect(() => {
    if (overrideGrouping && (!groupBy || groupBy.length === 0)) {
      setValue(`contactPoints.${alertManager}.groupBy`, getDefaultGroupByLabels());
    }
  }, [overrideGrouping, groupBy, setValue, alertManager]);

  const separator = <span>, </span>;

  return (
    <Stack direction="column">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <InlineField
          label={t('alerting.routing-settings.label-override-grouping', 'Override grouping')}
          transparent={true}
          className={styles.switchElement}
        >
          <Switch id="override-grouping-toggle" {...register(`contactPoints.${alertManager}.overrideGrouping`)} />
        </InlineField>
        {!overrideGrouping && (
          <Text variant="body" color="secondary">
            <Trans
              i18nKey="alerting.routing-settings.grouping"
              values={{ fields: getDefaultGroupByLabels().join(', ') }}
            >
              Grouping: <strong>{'{{fields}}'}</strong>
            </Trans>
          </Text>
        )}
      </Stack>
      {overrideGrouping && (
        <Field
          noMargin
          label={t('alerting.routing-settings.label-group-by', 'Group by')}
          description={t(
            'alerting.routing-settings.description-group-by',
            'Alerts are always grouped by grafana_folder and alertname, plus any additional labels you select. Select "Disable (...)" to send each alert as a separate notification.'
          )}
          {...register(`contactPoints.${alertManager}.groupBy`)}
          invalid={!!errors.contactPoints?.[alertManager]?.groupBy}
          className={styles.optionalContent}
        >
          <Controller
            render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => {
              const currentValues = field.value || [];

              return (
                <>
                  <MultiSelect
                    aria-label={t('alerting.routing-settings.aria-label-group-by', 'Group by')}
                    {...field}
                    allowCustomValue
                    className={formStyles.input}
                    onCreateOption={(opt: string) => {
                      setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                      setValue(`contactPoints.${alertManager}.groupBy`, nextGroupBy([...currentValues, opt]));
                    }}
                    onChange={(value) => {
                      const newValues = mapMultiSelectValueToStrings(value);
                      const pickedDisable =
                        newValues.includes(DISABLE_GROUPING) && !currentValues.includes(DISABLE_GROUPING);
                      onChange(nextGroupBy(newValues, pickedDisable ? DISABLE_GROUPING : undefined));
                    }}
                    options={[...commonGroupByOptions, ...groupByOptions]}
                  />
                  <Text variant="bodySmall" color="secondary">
                    <Trans i18nKey="alerting.routing-settings.group-by-hint">
                      grafana_folder and alertname are always included unless you select Disable (...).
                    </Trans>
                  </Text>
                  {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
                </>
              );
            }}
            name={`contactPoints.${alertManager}.groupBy`}
            control={control}
          />
        </Field>
      )}
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <InlineField
          label={t('alerting.routing-settings.label-override-timings', 'Override timings')}
          transparent={true}
          className={styles.switchElement}
        >
          <Switch id="override-timings-toggle" {...register(`contactPoints.${alertManager}.overrideTimings`)} />
        </InlineField>
        {!overrideTimings && (
          <Text variant="body" color="secondary">
            <Trans i18nKey="alerting.routing-settings.group-wait" values={{ groupWaitValue }}>
              Group wait: <strong>{'{{groupWaitValue}}'}</strong>
            </Trans>
            {separator}
            <Trans i18nKey="alerting.routing-settings.group-interval" values={{ groupIntervalValue }}>
              Group interval: <strong>{'{{groupIntervalValue}}'}</strong>
            </Trans>
            {separator}
            <Trans i18nKey="alerting.routing-settings.repeat-interval" values={{ repeatIntervalValue }}>
              Repeat interval: <strong>{'{{repeatIntervalValue}}'}</strong>
            </Trans>
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
