import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, FieldValidationMessage, InlineField, MultiSelect, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
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
  const groupBy = watch(`contactPoints.${alertManager}.groupBy`);

  const styles = useStyles2(getStyles);

  // Set default groupBy values when override grouping is enabled and field is empty
  useEffect(() => {
    if (overrideGrouping && (!groupBy || groupBy.length === 0)) {
      setValue(`contactPoints.${alertManager}.groupBy`, REQUIRED_FIELDS_IN_GROUPBY);
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
              values={{ fields: REQUIRED_FIELDS_IN_GROUPBY.join(', ') }}
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

                      // If '...' is selected, remove it and add required fields + new option
                      if (currentValues.includes(DISABLE_GROUPING)) {
                        setValue(`contactPoints.${alertManager}.groupBy`, [...REQUIRED_FIELDS_IN_GROUPBY, opt]);
                      } else {
                        // @ts-ignore-check: react-hook-form made me do this
                        setValue(`contactPoints.${alertManager}.groupBy`, [...field.value, opt]);
                      }
                    }}
                    onChange={(value) => {
                      const newValues = mapMultiSelectValueToStrings(value);
                      const hadDisableGrouping = currentValues.includes(DISABLE_GROUPING);
                      const nowHasDisableGrouping = newValues.includes(DISABLE_GROUPING);

                      // If user just selected '...', clear all other values
                      if (nowHasDisableGrouping && !hadDisableGrouping) {
                        return onChange([DISABLE_GROUPING]);
                      }

                      // If user added a label while '...' was selected, remove '...' and add required fields
                      if (hadDisableGrouping && nowHasDisableGrouping && newValues.length > 1) {
                        const withoutDisable = newValues.filter((v) => v !== DISABLE_GROUPING);
                        const withRequiredFields = [...REQUIRED_FIELDS_IN_GROUPBY];
                        for (const val of withoutDisable) {
                          if (!withRequiredFields.includes(val)) {
                            withRequiredFields.push(val);
                          }
                        }
                        return onChange(withRequiredFields);
                      }

                      // If user removed '...', restore the required fields
                      if (hadDisableGrouping && !nowHasDisableGrouping) {
                        return onChange(REQUIRED_FIELDS_IN_GROUPBY);
                      }

                      // If not using '...', ensure required fields are always included
                      if (!nowHasDisableGrouping) {
                        const withRequiredFields = [...newValues];
                        for (const field of REQUIRED_FIELDS_IN_GROUPBY) {
                          if (!withRequiredFields.includes(field)) {
                            withRequiredFields.unshift(field);
                          }
                        }
                        return onChange(withRequiredFields);
                      }

                      return onChange(newValues);
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
