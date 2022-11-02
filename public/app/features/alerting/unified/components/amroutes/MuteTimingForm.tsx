import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Alert, Field, FieldSet, Input, Button, LinkButton, useStyles2 } from '@grafana/ui';
import {
  AlertmanagerConfig,
  AlertManagerCortexConfig,
  MuteTimeInterval,
} from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from '../../hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { MuteTimingFields } from '../../types/mute-timing-form';
import { renameMuteTimings } from '../../utils/alertmanager';
import { makeAMLink } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval } from '../../utils/mute-timings';
import { initialAsyncRequestState } from '../../utils/redux';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';

interface Props {
  muteTiming?: MuteTimeInterval;
  showError?: boolean;
  provenance?: string;
}

const useDefaultValues = (muteTiming?: MuteTimeInterval): MuteTimingFields => {
  return useMemo(() => {
    const defaultValues = {
      name: '',
      time_intervals: [defaultTimeInterval],
    };

    if (!muteTiming) {
      return defaultValues;
    }

    const intervals = muteTiming.time_intervals.map((interval) => ({
      times: interval.times ?? defaultTimeInterval.times,
      weekdays: interval?.weekdays?.join(', ') ?? defaultTimeInterval.weekdays,
      days_of_month: interval?.days_of_month?.join(', ') ?? defaultTimeInterval.days_of_month,
      months: interval?.months?.join(', ') ?? defaultTimeInterval.months,
      years: interval?.years?.join(', ') ?? defaultTimeInterval.years,
    }));

    return {
      name: muteTiming.name,
      time_intervals: intervals,
    };
  }, [muteTiming]);
};

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'sitemap',
  breadcrumbs: [{ title: 'Notification Policies', url: 'alerting/routes' }],
};

const MuteTimingForm = ({ muteTiming, showError, provenance }: Props) => {
  const dispatch = useDispatch();
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const styles = useStyles2(getStyles);

  const defaultAmCortexConfig = { alertmanager_config: {}, template_files: {} };
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const { result = defaultAmCortexConfig, loading } =
    (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

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

    dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: result,
        alertManagerSourceName: alertManagerSourceName!,
        successMessage: 'Mute timing saved',
        redirectPath: '/alerting/routes/',
      })
    );
  };

  return (
    <AlertingPageWrapper
      pageId="am-routes"
      pageNav={{
        ...defaultPageNav,
        id: muteTiming ? 'alert-policy-edit' : 'alert-policy-new',
        text: muteTiming ? 'Edit mute timing' : 'New mute timing',
      }}
    >
      <AlertManagerPicker
        current={alertManagerSourceName}
        onChange={setAlertManagerSourceName}
        disabled
        dataSources={alertManagers}
      />
      {provenance && <ProvisioningAlert resource={ProvisionedResource.MuteTiming} />}
      {result && !loading && (
        <FormProvider {...formApi}>
          <form onSubmit={formApi.handleSubmit(onSubmit)} data-testid="mute-timing-form">
            {showError && <Alert title="No matching mute timing found" />}
            <FieldSet label={'Create mute timing'} disabled={Boolean(provenance)}>
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
                      return value.length > 0 || 'Name is required';
                    },
                  })}
                  className={styles.input}
                  data-testid={'mute-timing-name'}
                />
              </Field>
              <MuteTimingTimeInterval />
              <LinkButton
                type="button"
                variant="secondary"
                href={makeAMLink('/alerting/routes/', alertManagerSourceName)}
              >
                Cancel
              </LinkButton>
              <Button type="submit" className={styles.submitButton}>
                {muteTiming ? 'Save' : 'Submit'}
              </Button>
            </FieldSet>
          </form>
        </FormProvider>
      )}
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    width: 400px;
  `,
  submitButton: css`
    margin-left: ${theme.spacing(1)};
  `,
});

export default MuteTimingForm;
