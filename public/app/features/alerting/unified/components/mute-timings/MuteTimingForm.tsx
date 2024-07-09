import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, Button, Field, FieldSet, Input, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import {
  useCreateMuteTiming,
  useUpdateMuteTiming,
  useValidateMuteTiming,
} from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { shouldUseK8sApi } from 'app/features/alerting/unified/components/mute-timings/util';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { MuteTimingFields } from '../../types/mute-timing-form';
import { makeAMLink } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval, isTimeIntervalDisabled } from '../../utils/mute-timings';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';

interface Props {
  muteTiming?: MuteTimeInterval;
  showError?: boolean;
  loading?: boolean;
  /** Is the current mute timing provisioned? If so, will disable editing via UI */
  provisioned?: boolean;
  /** Are we editing an existing time interval? */
  editMode?: boolean;
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
    times: interval.times,
    weekdays: interval.weekdays?.join(', '),
    days_of_month: interval.days_of_month?.join(', '),
    months: interval.months?.join(', '),
    years: interval.years?.join(', '),
    location: interval.location ?? defaultTimeInterval.location,
    disable: isTimeIntervalDisabled(interval),
  }));

  return {
    name: muteTiming.name,
    time_intervals: intervals,
  };
};

const MuteTimingForm = ({ muteTiming, showError, loading, provisioned, editMode }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const hookArgs = { alertmanager: selectedAlertmanager! };
  const createTimeInterval = useCreateMuteTiming(hookArgs);
  const updateTimeInterval = useUpdateMuteTiming(hookArgs);
  const validateMuteTiming = useValidateMuteTiming(hookArgs);
  /**
   * The k8s API approach does not support renaming an entity at this time,
   * as it requires renaming all other references of this entity.
   *
   * For now, the cleanest solution is to disabled renaming the field in this scenario
   */
  const disableNameField = editMode && shouldUseK8sApi(selectedAlertmanager!);
  const styles = useStyles2(getStyles);
  const [updating, setUpdating] = useState(false);
  const defaultValues = useDefaultValues(muteTiming);

  const formApi = useForm({ defaultValues, values: defaultValues });

  const returnLink = makeAMLink('/alerting/routes/', selectedAlertmanager!, { tab: 'mute_timings' });

  const onSubmit = async (values: MuteTimingFields) => {
    setUpdating(true);
    const timeInterval = createMuteTiming(values);

    const updateOrCreate = async () => {
      if (editMode) {
        return updateTimeInterval({ timeInterval, originalName: muteTiming?.metadata?.name || muteTiming!.name });
      }
      return createTimeInterval({ timeInterval });
    };

    return updateOrCreate()
      .then(() => {
        locationService.push(returnLink);
      })
      .finally(() => {
        setUpdating(false);
      });
  };

  if (loading) {
    return <LoadingPlaceholder text="Loading mute timing" />;
  }

  if (showError) {
    return <Alert title="No matching mute timing found" />;
  }

  return (
    <>
      {provisioned && <ProvisioningAlert resource={ProvisionedResource.MuteTiming} />}
      <FormProvider {...formApi}>
        <form onSubmit={formApi.handleSubmit(onSubmit)} data-testid="mute-timing-form">
          <FieldSet label={'Create mute timing'} disabled={provisioned || updating}>
            <Field
              required
              label="Name"
              description="A unique name for the mute timing"
              invalid={!!formApi.formState.errors?.name}
              error={formApi.formState.errors.name?.message}
              disabled={disableNameField}
            >
              <Input
                {...formApi.register('name', {
                  required: true,
                  validate: async (value) => {
                    const skipValidation = editMode && value === muteTiming?.name;
                    return validateMuteTiming(value, skipValidation);
                  },
                })}
                className={styles.input}
                data-testid={'mute-timing-name'}
              />
            </Field>
            <MuteTimingTimeInterval />
            <Button
              type="submit"
              className={styles.submitButton}
              disabled={updating}
              icon={updating ? 'spinner' : undefined}
            >
              {updating ? (
                <Trans i18nKey="alerting.mute-timings.saving">Saving mute timing</Trans>
              ) : (
                <Trans i18nKey="alerting.mute-timings.save">Save mute timing</Trans>
              )}
            </Button>
            <LinkButton type="button" variant="secondary" fill="outline" href={returnLink} disabled={updating}>
              <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
            </LinkButton>
          </FieldSet>
        </form>
      </FormProvider>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css({
    width: '400px',
  }),
  submitButton: css({
    marginRight: theme.spacing(1),
  }),
});

export default MuteTimingForm;
