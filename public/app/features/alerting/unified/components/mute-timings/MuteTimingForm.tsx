import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Field, FieldSet, Input, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import {
  AlertmanagerConfig,
  AlertManagerCortexConfig,
  MuteTimeInterval,
} from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { MuteTimingFields } from '../../types/mute-timing-form';
import { renameMuteTimings } from '../../utils/alertmanager';
import { makeAMLink } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval } from '../../utils/mute-timings';
import { initialAsyncRequestState } from '../../utils/redux';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';

interface Props {
  muteTiming?: MuteTimeInterval;
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

const MuteTimingForm = ({ muteTiming, showError, loading, provenance }: Props) => {
  const dispatch = useDispatch();
  const { selectedAlertmanager } = useAlertmanager();
  const styles = useStyles2(getStyles);

  const [updating, setUpdating] = useState(false);

  const defaultAmCortexConfig = { alertmanager_config: {}, template_files: {} };
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const { result = defaultAmCortexConfig } =
    (selectedAlertmanager && amConfigs[selectedAlertmanager]) || initialAsyncRequestState;

  const config: AlertmanagerConfig = result?.alertmanager_config ?? {};
  const defaultValues = useDefaultValues(muteTiming);
  const formApi = useForm({ defaultValues });

  const onSubmit = (values: MuteTimingFields) => {
    const newMuteTiming = createMuteTiming(values);

    const muteTimings = muteTiming
      ? config?.mute_time_intervals?.filter(({ name }) => name !== muteTiming.name)
      : config.mute_time_intervals;

    const newConfig: AlertManagerCortexConfig = {
      ...result,
      alertmanager_config: {
        ...config,
        route:
          muteTiming && newMuteTiming.name !== muteTiming.name
            ? renameMuteTimings(newMuteTiming.name, muteTiming.name, config.route ?? {})
            : config.route,
        mute_time_intervals: [...(muteTimings || []), newMuteTiming],
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
                    validate: (value) => {
                      if (!muteTiming) {
                        const existingMuteTiming = config?.mute_time_intervals?.find(({ name }) => value === name);
                        return existingMuteTiming ? `Mute timing already exists for "${value}"` : true;
                      }
                      return;
                    },
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

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    width: 400px;
  `,
  submitButton: css`
    margin-right: ${theme.spacing(1)};
  `,
});

export default MuteTimingForm;
