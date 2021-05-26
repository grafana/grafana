import { useCleanup } from 'app/core/hooks/useCleanup';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useForm, FormProvider } from 'react-hook-form';
import { globalConfigOptions } from '../../utils/cloud-alertmanager-notifier-types';
import { OptionField } from './form/fields/OptionField';
import { Alert, Button, HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';
import { makeAMLink } from '../../utils/misc';
import { useDispatch } from 'react-redux';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { omitEmptyValues } from '../../utils/receiver-form';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

type FormValues = Record<string, unknown>;

const defaultValues: FormValues = {
  smtp_require_tls: true,
} as const;

export const GlobalConfigForm: FC<Props> = ({ config, alertManagerSourceName }) => {
  const dispatch = useDispatch();
  useCleanup((state) => state.unifiedAlerting.saveAMConfig);
  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const styles = useStyles2(getStyles);

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
        <h4 className={styles.heading}>Global config</h4>
        {error && (
          <Alert severity="error" title="Error saving receiver">
            {error.message || String(error)}
          </Alert>
        )}
        {globalConfigOptions.map((option) => (
          <OptionField
            defaultValue={defaultValues[option.propertyName]}
            key={option.propertyName}
            option={option}
            error={errors[option.propertyName]}
            pathPrefix={''}
          />
        ))}
        <div>
          <HorizontalGroup>
            {loading && (
              <Button disabled={true} icon="fa fa-spinner" variant="primary">
                Saving...
              </Button>
            )}
            {!loading && <Button type="submit">Save global config</Button>}
            <LinkButton
              disabled={loading}
              fill="outline"
              variant="secondary"
              href={makeAMLink('alerting/notifications', alertManagerSourceName)}
            >
              Cancel
            </LinkButton>
          </HorizontalGroup>
        </div>
      </form>
    </FormProvider>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    margin: ${theme.spacing(4, 0)};
  `,
});
