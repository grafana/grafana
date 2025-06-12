import { useMemo } from 'react';

import { AadCurrentUserCredentials, AzureCredentials, instanceOfAzureCredential } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfigSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Select, Field, RadioButtonGroup, Alert, Stack, TextLink } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';

import { AppRegistrationCredentials } from './AppRegistrationCredentials';

export interface Props {
  managedIdentityEnabled: boolean;
  workloadIdentityEnabled: boolean;
  credentials: AadCurrentUserCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
  children?: JSX.Element;
}

export const CurrentUserFallbackCredentials = (props: Props) => {
  const {
    credentials,
    azureCloudOptions,
    onCredentialsChange,
    disabled,
    managedIdentityEnabled,
    workloadIdentityEnabled,
  } = props;

  type FallbackCredentialAuthTypeOptions = 'clientsecret' | 'msi' | 'workloadidentity';
  const authTypeOptions = useMemo(() => {
    let opts: Array<SelectableValue<FallbackCredentialAuthTypeOptions>> = [
      {
        value: 'clientsecret',
        label: 'App Registration',
      },
    ];

    if (managedIdentityEnabled) {
      opts.push({
        value: 'msi',
        label: 'Managed Identity',
      });
    }

    if (workloadIdentityEnabled) {
      opts.push({
        value: 'workloadidentity',
        label: 'Workload Identity',
      });
    }

    return opts;
  }, [managedIdentityEnabled, workloadIdentityEnabled]);

  const onAuthTypeChange = (selected: SelectableValue<FallbackCredentialAuthTypeOptions>) => {
    const defaultAuthType = managedIdentityEnabled
      ? 'msi'
      : workloadIdentityEnabled
        ? 'workloadidentity'
        : 'clientsecret';
    const updated: AadCurrentUserCredentials = {
      ...credentials,
      serviceCredentials: {
        authType: selected.value || defaultAuthType,
      },
    };
    onCredentialsChange(updated);
  };

  const onServiceCredentialsEnabledChange = (value: boolean) => {
    let updated: AzureCredentials = {
      ...credentials,
      serviceCredentialsEnabled: value,
    };
    if (!value) {
      updated = { ...updated, serviceCredentials: undefined };
    }
    onCredentialsChange(updated);
  };

  const onServiceCredentialsChange = (serviceCredentials: AzureCredentials) => {
    if (!instanceOfAzureCredential('currentuser', serviceCredentials)) {
      onCredentialsChange({ ...credentials, serviceCredentials: serviceCredentials });
    }
  };

  if (!config.azure.userIdentityFallbackCredentialsEnabled) {
    return (
      <Alert
        severity="info"
        title={t(
          'components.current-user-fallback-credentials.title-fallback-credentials-disabled',
          'Fallback Credentials Disabled'
        )}
      >
        <Trans i18nKey="components.current-user-fallback-credentials.alert-fallback-credentials-disabled">
          Fallback credentials have been disabled. As user-based authentication only inherently supports requests with a
          user in scope, features such as alerting, recorded queries, or reporting will not function as expected. Please
          review the{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/"
            external
          >
            documentation
          </TextLink>{' '}
          for more details.
        </Trans>
      </Alert>
    );
  }

  return (
    <ConfigSection
      title={t(
        'components.current-user-fallback-credentials.title-fallback-service-credentials',
        'Fallback Service Credentials'
      )}
      isCollapsible={true}
    >
      <Alert
        severity="info"
        title={t('components.current-user-fallback-credentials.title-service-credentials', 'Service Credentials')}
      >
        <Stack direction={'column'}>
          <div>
            <Trans i18nKey="components.current-user-fallback-credentials.body-service-credentials">
              User-based authentication does not inherently support Grafana features that make requests to the data
              source without a users details available to the request. An example of this is alerting. If you wish to
              ensure that features that do not have a user in the context of the request still function, please provide
              fallback credentials below.
            </Trans>
          </div>
          <div>
            <b>
              <Trans i18nKey="components.current-user-fallback-credentials.note-service-credentials">
                Note: Features like alerting will be restricted to the access level of the fallback credentials rather
                than the user. This may present confusion for users and should be clarified.
              </Trans>
            </b>
          </div>
        </Stack>
      </Alert>
      <Field
        label={t('components.current-user-fallback-credentials.label-service-credentials', 'Service Credentials')}
        description={t(
          'components.current-user-fallback-credentials.description-service-credentials',
          'Choose if fallback service credentials are enabled or disabled for this data source'
        )}
        data-testid={selectors.components.configEditor.serviceCredentialsEnabled.button}
      >
        <RadioButtonGroup
          options={[
            { label: 'Enabled', value: true },
            { label: 'Disabled', value: false },
          ]}
          value={credentials.serviceCredentialsEnabled ?? false}
          size={'md'}
          onChange={(val) => onServiceCredentialsEnabledChange(val)}
        />
      </Field>
      {credentials.serviceCredentialsEnabled ? (
        <>
          {authTypeOptions.length > 0 && (
            <Field
              label={t('components.current-user-fallback-credentials.label-authentication', 'Authentication')}
              description={t(
                'components.current-user-fallback-credentials.description-authentication',
                'Choose the type of authentication to Azure services'
              )}
              data-testid={selectors.components.configEditor.authType.select}
              htmlFor="authentication-type"
            >
              <Select
                className="width-15"
                value={authTypeOptions.find((opt) => opt.value === credentials.serviceCredentials?.authType)}
                options={authTypeOptions}
                onChange={onAuthTypeChange}
                disabled={disabled}
              />
            </Field>
          )}
          {credentials.serviceCredentials?.authType === 'clientsecret' && (
            <AppRegistrationCredentials
              credentials={credentials.serviceCredentials}
              azureCloudOptions={azureCloudOptions}
              onCredentialsChange={onServiceCredentialsChange}
              disabled={disabled}
            />
          )}
        </>
      ) : null}
      {props.children}
    </ConfigSection>
  );
};

export default CurrentUserFallbackCredentials;
