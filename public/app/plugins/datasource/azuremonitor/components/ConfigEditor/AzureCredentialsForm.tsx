import { useMemo } from 'react';

import { AzureAuthType, AzureCredentials, getAzureClouds } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ConfigSection } from '@grafana/plugin-ui';
import { Select, Field } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';

import { AppRegistrationCredentials } from './AppRegistrationCredentials';
import CurrentUserFallbackCredentials from './CurrentUserFallbackCredentials';

export interface Props {
  managedIdentityEnabled: boolean;
  workloadIdentityEnabled: boolean;
  userIdentityEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
  children?: JSX.Element;
}

export function getAzureCloudOptions(): Array<SelectableValue<string>> {
  const cloudInfo = getAzureClouds();

  return cloudInfo.map((cloud) => ({
    value: cloud.name,
    label: cloud.displayName,
  }));
}

export const AzureCredentialsForm = (props: Props) => {
  const {
    credentials,
    onCredentialsChange,
    disabled,
    managedIdentityEnabled,
    workloadIdentityEnabled,
    userIdentityEnabled,
  } = props;

  const authTypeOptions = useMemo(() => {
    let opts: Array<SelectableValue<AzureAuthType>> = [
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

    if (userIdentityEnabled) {
      opts.unshift({
        value: 'currentuser',
        label: 'Current User',
      });
    }

    return opts;
  }, [managedIdentityEnabled, workloadIdentityEnabled, userIdentityEnabled]);

  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    const defaultAuthType = (() => {
      if (managedIdentityEnabled) {
        return 'msi';
      }

      if (workloadIdentityEnabled) {
        return 'workloadidentity';
      }

      if (userIdentityEnabled) {
        return 'currentuser';
      }

      return 'clientsecret';
    })();

    const updated: AzureCredentials = {
      ...credentials,
      authType: selected.value || defaultAuthType,
    };

    onCredentialsChange(updated);
  };

  return (
    <ConfigSection title={t('components.azure-credentials-form.title-authentication', 'Authentication')}>
      {authTypeOptions.length > 1 && (
        <Field
          label={t('components.azure-credentials-form.label-authentication', 'Authentication')}
          description={t(
            'components.azure-credentials-form.description-authentication',
            'Choose the type of authentication to Azure services'
          )}
          data-testid={selectors.components.configEditor.authType.select}
          htmlFor="authentication-type"
        >
          <Select
            className="width-15"
            value={authTypeOptions.find((opt) => opt.value === credentials.authType)}
            options={authTypeOptions}
            onChange={onAuthTypeChange}
            disabled={disabled}
          />
        </Field>
      )}
      {credentials.authType === 'clientsecret' && (
        <AppRegistrationCredentials
          credentials={credentials}
          azureCloudOptions={getAzureCloudOptions()}
          onCredentialsChange={onCredentialsChange}
          disabled={disabled}
        />
      )}
      {props.children}
      {credentials.authType === 'currentuser' && (
        <CurrentUserFallbackCredentials
          credentials={credentials}
          azureCloudOptions={getAzureCloudOptions()}
          onCredentialsChange={onCredentialsChange}
          disabled={disabled}
          managedIdentityEnabled={managedIdentityEnabled}
          workloadIdentityEnabled={workloadIdentityEnabled}
        />
      )}
    </ConfigSection>
  );
};

export default AzureCredentialsForm;
