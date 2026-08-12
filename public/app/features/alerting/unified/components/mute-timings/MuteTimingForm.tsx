import { css } from '@emotion/css';
import { FormProvider, useForm } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, isFetchError, locationService } from '@grafana/runtime';
import { Alert, Button, Field, FieldSet, Input, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  type MuteTiming,
  useCreateMuteTiming,
  useUpdateMuteTiming,
  useValidateMuteTiming,
} from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';

import { logError, logWarning } from '../../Analytics';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { type MuteTimingFields } from '../../types/mute-timing-form';
import { isImportedResource, isProvisionedResource } from '../../utils/k8s/utils';
import { makeAMLink, stringifyErrorLike } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval, isTimeIntervalDisabled } from '../../utils/mute-timings';
import { ALERTING_PATHS } from '../../utils/navigation';
import { ImportedTimeIntervalAlert, ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';

interface Props {
  muteTiming?: MuteTiming;
  showError?: boolean;
  loading?: boolean;
  /** Provenance of the mute timing - indicates how it was created (e.g., 'file', 'prometheus_convert', 'none') */
  provenance?: string;
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

const MuteTimingForm = ({ muteTiming, showError, loading, provenance, editMode }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const notifyApp = useAppNotification();
  const hookArgs = { alertmanager: selectedAlertmanager! };

  const [createTimeInterval] = useCreateMuteTiming(hookArgs);
  const [updateTimeInterval] = useUpdateMuteTiming(hookArgs);
  const validateMuteTiming = useValidateMuteTiming(hookArgs);

  const styles = useStyles2(getStyles);
  const defaultValues = useDefaultValues(muteTiming);

  const formApi = useForm({ defaultValues, values: defaultValues });

  const updating = formApi.formState.isSubmitting;

  // V2 nav has dedicated time intervals page, legacy nav uses tab parameter
  const useV2Nav = config.featureToggles.alertingNavigationV2;
  const returnLink = useV2Nav
    ? makeAMLink(ALERTING_PATHS.TIME_INTERVALS, selectedAlertmanager!)
    : makeAMLink(ALERTING_PATHS.ROUTES + '/', selectedAlertmanager!, { tab: 'time_intervals' });

  const onSubmit = async (values: MuteTimingFields) => {
    const interval = createMuteTiming(values);

    const updateOrCreate = async () => {
      if (editMode) {
        return updateTimeInterval.execute({ interval, originalName: muteTiming?.metadata?.name || muteTiming!.name });
      }
      return createTimeInterval.execute({ interval });
    };

    try {
      await updateOrCreate();
      locationService.push(returnLink);
    } catch (error) {
      if (error instanceof Error || isFetchError(error)) {
        const title = t('alerting.time-interval-form.error-save-time-interval', 'Failed to save time interval');
        const message = stringifyErrorLike(error);
        notifyApp.error(title, message);

        if (isFetchError(error) && error.status >= 400 && error.status < 500) {
          logWarning(title, { status: String(error.status), message });
        } else {
          const saveError = new Error(title);
          saveError.cause = error;
          logError(saveError);
        }
      }
    }
  };

  if (loading) {
    return (
      <LoadingPlaceholder text={t('alerting.time-interval-form.text-loading-time-interval', 'Loading time interval')} />
    );
  }

  if (showError) {
    return (
      <Alert
        title={t(
          'alerting.time-interval-form.title-no-matching-time-interval-found',
          'No matching time interval found'
        )}
      />
    );
  }

  const isProvisioned = isProvisionedResource(provenance);
  const isImported = isImportedResource(provenance);

  return (
    <>
      {isProvisioned && isImported && <ImportedTimeIntervalAlert />}
      {isProvisioned && !isImported && <ProvisioningAlert resource={ProvisionedResource.MuteTiming} />}
      <FormProvider {...formApi}>
        <form onSubmit={formApi.handleSubmit(onSubmit)} data-testid="mute-timing-form">
          <FieldSet disabled={isProvisioned || updating}>
            <Field
              required
              noMargin
              label={t('alerting.mute-timing-form.label-name', 'Name')}
              description={t(
                'alerting.time-interval-form.description-unique-time-interval',
                'A unique name for the time interval'
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
                <Trans i18nKey="alerting.time-interval.saving">Saving time interval</Trans>
              ) : (
                <Trans i18nKey="alerting.time-interval.save">Save time interval</Trans>
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
