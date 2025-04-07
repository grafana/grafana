import { FormProvider, useForm } from 'react-hook-form';

import { Alert, Button, LinkButton, Stack } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { Trans, t } from 'app/core/internationalization';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { globalConfigOptions } from '../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { omitEmptyValues } from '../../utils/receiver-form';
import { initialAsyncRequestState } from '../../utils/redux';

import { OptionField } from './form/fields/OptionField';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

type FormValues = Record<string, unknown>;

const defaultValues: FormValues = {
  smtp_require_tls: true,
} as const;

export const GlobalConfigForm = ({ config, alertManagerSourceName }: Props) => {
  const dispatch = useDispatch();

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
  const readOnly = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);

  const formAPI = useForm<FormValues>({
    // making a copy here beacuse react-hook-form will mutate these, and break if the object is frozen. for real.
    defaultValues: JSON.parse(
      JSON.stringify({
        ...defaultValues,
        ...(config.alertmanager_config.global ?? {}),
      })
    ),
  });

  const {
    handleSubmit,
    formState: { errors },
  } = formAPI;

  const onSubmitCallback = (values: FormValues) => {
    dispatch(
      updateAlertManagerConfigAction({
        newConfig: {
          ...config,
          alertmanager_config: {
            ...config.alertmanager_config,
            global: omitEmptyValues(values),
          },
        },
        oldConfig: config,
        alertManagerSourceName,
        successMessage: 'Global config updated.',
        redirectPath: makeAMLink('/alerting/notifications', alertManagerSourceName),
      })
    );
  };

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit(onSubmitCallback)}>
        {error && (
          <Alert
            severity="error"
            title={t('alerting.global-config-form.title-error-saving-receiver', 'Error saving receiver')}
          >
            {error.message || String(error)}
          </Alert>
        )}
        {globalConfigOptions.map((option) => (
          <OptionField
            readOnly={readOnly}
            defaultValue={defaultValues[option.propertyName]}
            key={option.propertyName}
            option={option}
            error={errors[option.propertyName]}
            pathPrefix={''}
          />
        ))}
        <div>
          <Stack>
            {!readOnly && (
              <>
                {loading && (
                  <Button disabled={true} icon="spinner" variant="primary">
                    <Trans i18nKey="alerting.global-config-form.saving">Saving...</Trans>
                  </Button>
                )}
                {!loading && (
                  <Button type="submit">
                    <Trans i18nKey="alerting.global-config-form.save-global-config">Save global config</Trans>
                  </Button>
                )}
              </>
            )}
            <LinkButton
              disabled={loading}
              fill="outline"
              variant="secondary"
              href={makeAMLink('alerting/notifications', alertManagerSourceName)}
            >
              <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
            </LinkButton>
          </Stack>
        </div>
      </form>
    </FormProvider>
  );
};
