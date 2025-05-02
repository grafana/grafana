import { css } from '@emotion/css';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, Button, Field, FieldSet, Input, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import {
  MuteTiming,
  useCreateMuteTiming,
  useUpdateMuteTiming,
  useValidateMuteTiming,
} from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { MuteTimingFields } from '../../types/mute-timing-form';
import { makeAMLink } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval, isTimeIntervalDisabled } from '../../utils/mute-timings';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';

interface Props {
  muteTiming?: MuteTiming;
  showError?: boolean;
  loading?: boolean;
  /** Is the current mute timing provisioned? If so, will disable editing via UI */
  provisioned?: boolean;
  /** Are we editing an existing time interval? */
  editMode?: boolean;
}

const useDefaultValues = (muteTiming?: MuteTiming): MuteTimingFields => {
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

  const [createTimeInterval] = useCreateMuteTiming(hookArgs);
  const [updateTimeInterval] = useUpdateMuteTiming(hookArgs);
  const validateMuteTiming = useValidateMuteTiming(hookArgs);

  const styles = useStyles2(getStyles);
  const defaultValues = useDefaultValues(muteTiming);

  const formApi = useForm({ defaultValues, values: defaultValues });
  const updating = formApi.formState.isSubmitting;

  const returnLink = makeAMLink('/alerting/routes/', selectedAlertmanager!, { tab: 'mute_timings' });

  const onSubmit = async (values: MuteTimingFields) => {
    const interval = createMuteTiming(values);

    const updateOrCreate = async () => {
      if (editMode) {
        return updateTimeInterval.execute({ interval, originalName: muteTiming?.metadata?.name || muteTiming!.name });
      }
      return createTimeInterval.execute({ interval });
    };

    return updateOrCreate().then(() => {
      locationService.push(returnLink);
    });
  };

  if (loading) {
    return <LoadingPlaceholder text={t('alerting.mute-timing-form.text-loading-mute-timing', 'Loading mute timing')} />;
  }

  if (showError) {
    return (
      <Alert
        title={t('alerting.mute-timing-form.title-no-matching-mute-timing-found', 'No matching mute timing found')}
      />
    );
  }

  return (
    <>
      {provisioned && <ProvisioningAlert resource={ProvisionedResource.MuteTiming} />}
      <FormProvider {...formApi}>
        <form onSubmit={formApi.handleSubmit(onSubmit)} data-testid="mute-timing-form">
          <FieldSet disabled={provisioned || updating}>
            <Field
              required
              label={t('alerting.mute-timing-form.label-name', 'Name')}
              description={t(
                'alerting.mute-timing-form.description-unique-timing',
                'A unique name for the mute timing'
              )}
              invalid={!!formApi.formState.errors?.name}
              error={formApi.formState.errors.name?.message}
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
