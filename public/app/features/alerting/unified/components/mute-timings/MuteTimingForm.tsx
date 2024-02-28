import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Field, FieldSet, Input, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { MuteTimingFields } from '../../types/mute-timing-form';
import { renameMuteTimings } from '../../utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval } from '../../utils/mute-timings';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';

interface Props {
  fromLegacyTimeInterval?: MuteTimeInterval; // mute time interval when comes from the old config , mute_time_intervals
  fromTimeIntervals?: MuteTimeInterval; // mute time interval when comes from the new config , time_intervals. These two fields are mutually exclusive
  showError?: boolean;
  provenance?: string;
  loading?: boolean;
}

const useDefaultValues = (muteTiming?: MuteTimeInterval): MuteTimingFields => {
  const defaultValues = {
    name: '',
    time_intervals: [defaultTimeInterval],
  };

  if (!muteTiming) {
    return defaultValues;
  }

  const intervals = muteTiming.time_intervals.map((interval) => ({
    times: interval.times ?? defaultTimeInterval.times,
    weekdays: interval.weekdays?.join(', ') ?? defaultTimeInterval.weekdays,
    days_of_month: interval.days_of_month?.join(', ') ?? defaultTimeInterval.days_of_month,
    months: interval.months?.join(', ') ?? defaultTimeInterval.months,
    years: interval.years?.join(', ') ?? defaultTimeInterval.years,
    location: interval.location ?? defaultTimeInterval.location,
  }));

  return {
    name: muteTiming.name,
    time_intervals: intervals,
  };
};

const replaceMuteTiming = (
  originalTimings: MuteTimeInterval[],
  existingTiming: MuteTimeInterval | undefined,
  newTiming: MuteTimeInterval,
  addNew: boolean
) => {
  // we only add new timing if addNew is true. Otherwise, we just remove the existing timing
  const originalTimingsWithoutNew = existingTiming
    ? originalTimings?.filter(({ name }) => name !== existingTiming.name)
    : originalTimings;
  return addNew ? [...originalTimingsWithoutNew, newTiming] : [...originalTimingsWithoutNew];
};

const MuteTimingForm = ({
  fromLegacyTimeInterval: fromMuteTimings,
  fromTimeIntervals,
  showError,
  loading,
  provenance,
}: Props) => {
  const dispatch = useDispatch();
  const { selectedAlertmanager } = useAlertmanager();
  const styles = useStyles2(getStyles);

  const [updating, setUpdating] = useState(false);

  const { currentData: result } = useAlertmanagerConfig(selectedAlertmanager);
  const config = result?.alertmanager_config;

  const fromIntervals = Boolean(fromTimeIntervals);
  const muteTiming = fromIntervals ? fromTimeIntervals : fromMuteTimings;

  const originalMuteTimings = config?.mute_time_intervals ?? [];
  const originalTimeIntervals = config?.time_intervals ?? [];

  const defaultValues = useDefaultValues(muteTiming);
  const formApi = useForm({ defaultValues });

  const onSubmit = (values: MuteTimingFields) => {
    if (!result) {
      return;
    }

    const newMuteTiming = createMuteTiming(values);

    const isGrafanaDataSource = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
    const isNewMuteTiming = fromTimeIntervals === undefined && fromMuteTimings === undefined;

    // If is Grafana data source, we wil save mute timings in the alertmanager_config.mute_time_intervals
    // Otherwise, we will save it on alertmanager_config.time_intervals or alertmanager_config.mute_time_intervals depending on the original config

    const newMutetimeIntervals = isGrafanaDataSource
      ? {
          // for Grafana data source, we will save mute timings in the alertmanager_config.mute_time_intervals
          mute_time_intervals: [
            ...replaceMuteTiming(originalTimeIntervals, fromTimeIntervals, newMuteTiming, false),
            ...replaceMuteTiming(originalMuteTimings, fromMuteTimings, newMuteTiming, true),
          ],
        }
      : {
          // for non-Grafana data source, we will save mute timings in the alertmanager_config.time_intervals or alertmanager_config.mute_time_intervals depending on the original config
          time_intervals: replaceMuteTiming(
            originalTimeIntervals,
            fromTimeIntervals,
            newMuteTiming,
            Boolean(fromTimeIntervals) || isNewMuteTiming
          ),
          mute_time_intervals:
            Boolean(fromMuteTimings) && !isNewMuteTiming
              ? replaceMuteTiming(originalMuteTimings, fromMuteTimings, newMuteTiming, true)
              : undefined,
        };

    const { mute_time_intervals: _, time_intervals: __, ...configWithoutMuteTimings } = config ?? {};
    const newConfig: AlertManagerCortexConfig = {
      ...result,
      alertmanager_config: {
        ...configWithoutMuteTimings,
        route:
          muteTiming && newMuteTiming.name !== muteTiming.name
            ? renameMuteTimings(newMuteTiming.name, muteTiming.name, config?.route ?? {})
            : config?.route,
        ...newMutetimeIntervals,
      },
    };

    const saveAction = dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: result,
        alertManagerSourceName: selectedAlertmanager!,
        successMessage: 'Mute timing saved',
        redirectPath: '/alerting/routes/',
        redirectSearch: 'tab=mute_timings',
      })
    );

    setUpdating(true);

    saveAction.unwrap().finally(() => {
      setUpdating(false);
    });
  };

  return (
    <>
      {provenance && <ProvisioningAlert resource={ProvisionedResource.MuteTiming} />}
      {loading && <LoadingPlaceholder text="Loading mute timing" />}
      {showError && <Alert title="No matching mute timing found" />}
      {result && !loading && !showError && (
        <FormProvider {...formApi}>
          <form onSubmit={formApi.handleSubmit(onSubmit)} data-testid="mute-timing-form">
            <FieldSet label={'Create mute timing'} disabled={Boolean(provenance) || updating}>
              <Field
                required
                label="Name"
                description="A unique name for the mute timing"
                invalid={!!formApi.formState.errors?.name}
                error={formApi.formState.errors.name?.message}
              >
                <Input
                  {...formApi.register('name', {
                    required: true,
                    validate: (value) =>
                      validateMuteTiming(value, muteTiming, originalMuteTimings, originalTimeIntervals),
                  })}
                  className={styles.input}
                  data-testid={'mute-timing-name'}
                />
              </Field>
              <MuteTimingTimeInterval />
              <Button type="submit" className={styles.submitButton} disabled={updating}>
                Save mute timing
              </Button>
              <LinkButton
                type="button"
                variant="secondary"
                fill="outline"
                href={makeAMLink('/alerting/routes/', selectedAlertmanager, { tab: 'mute_timings' })}
                disabled={updating}
              >
                Cancel
              </LinkButton>
            </FieldSet>
          </form>
        </FormProvider>
      )}
    </>
  );
};

function validateMuteTiming(
  value: string,
  muteTiming: MuteTimeInterval | undefined,
  originalMuteTimings: MuteTimeInterval[],
  originalTimeIntervals: MuteTimeInterval[]
) {
  if (!muteTiming) {
    const existingMuteTimingInMuteTimings = originalMuteTimings?.find(({ name }) => value === name);
    const existingMuteTimingInTimeIntervals = originalTimeIntervals?.find(({ name }) => value === name);
    return existingMuteTimingInMuteTimings || existingMuteTimingInTimeIntervals
      ? `Mute timing already exists for "${value}"`
      : true;
  }
  return;
}

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    width: 400px;
  `,
  submitButton: css`
    margin-right: ${theme.spacing(1)};
  `,
});

export default MuteTimingForm;
