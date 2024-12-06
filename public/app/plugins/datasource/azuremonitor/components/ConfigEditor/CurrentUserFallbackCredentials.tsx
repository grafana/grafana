import { useMemo } from 'react';

import { AadCurrentUserCredentials, AzureCredentials, instanceOfAzureCredential } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Select, Field, RadioButtonGroup, Alert, Stack } from '@grafana/ui';

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
      <Alert severity="info" title="Fallback Credentials Disabled">
        <>
          Fallback credentials have been disabled. As user-based authentication only inherently supports requests with a
          user in scope, features such as alerting, recorded queries, or reporting will not function as expected. Please
          review the{' '}
          <a
            href="https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/"
            target="_blank"
            rel="noreferrer"
          >
            documentation
          </a>{' '}
          for more details.
        </>
      </Alert>
    );
  }

  return (
    <ConfigSection title="Fallback Service Credentials" isCollapsible={true}>
      <Alert severity="info" title="Service Credentials">
        <Stack direction={'column'}>
          <div>
            User-based authentication does not inherently support Grafana features that make requests to the data source
            without a users details available to the request. An example of this is alerting. If you wish to ensure that
            features that do not have a user in the context of the request still function, please provide fallback
            credentials below.
          </div>
          <div>
            <b>
              Note: Features like alerting will be restricted to the access level of the fallback credentials rather
              than the user. This may present confusion for users and should be clarified.
            </b>
          </div>
        </Stack>
      </Alert>
      <Field
        label="Service Credentials"
        description="Choose if fallback service credentials are enabled or disabled for this data source"
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
              label="Authentication"
              description="Choose the type of authentication to Azure services"
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
