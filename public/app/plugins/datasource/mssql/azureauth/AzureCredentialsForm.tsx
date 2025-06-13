import { ChangeEvent } from 'react';

import { AzureCredentials, AzureAuthType } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Select, Input } from '@grafana/ui';

export interface Props {
  managedIdentityEnabled: boolean;
  azureEntraPasswordCredentialsEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
}

export const AzureCredentialsForm = (props: Props) => {
  const {
    managedIdentityEnabled,
    azureEntraPasswordCredentialsEnabled,
    credentials,
    azureCloudOptions,
    onCredentialsChange,
    disabled,
  } = props;

  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        authType: selected.value || 'msi',
      };
      onCredentialsChange(updated);
    }
  };

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        azureCloud: selected.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        tenantId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        clientId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretReset = () => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: '',
      };
      onCredentialsChange(updated);
    }
  };

  const onUserIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        userId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        password: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onPasswordReset = () => {
    if (credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        password: '',
      };
      onCredentialsChange(updated);
    }
  };

  const authTypeOptions: Array<SelectableValue<AzureAuthType>> = [
    {
      value: 'clientsecret',
      label: t('azureauth.azure-credentials-form.auth-options-app-registration', 'App Registration'),
    },
  ];
  if (managedIdentityEnabled) {
    authTypeOptions.push({
      value: 'msi',
      label: t('azureauth.azure-credentials-form.auth-options-managed-identity', 'Managed Identity'),
    });
  }
  if (azureEntraPasswordCredentialsEnabled) {
    authTypeOptions.push({
      value: 'ad-password',
      label: t('azureauth.azure-credentials-form.auth-options-azure-entra', 'Azure Entra Password'),
    });
  }

  return (
    <div>
      <Field
        label={t('azureauth.azure-credentials-form.label-authentication', 'Authentication')}
        description={t(
          'azureauth.azure-credentials-form.description-authentication',
          'Choose the type of authentication to Azure services'
        )}
        htmlFor="authentication-type"
      >
        <Select
          width={20}
          value={authTypeOptions.find((opt) => opt.value === credentials.authType)}
          options={authTypeOptions}
          onChange={onAuthTypeChange}
          disabled={disabled}
        />
      </Field>
      {credentials.authType === 'clientsecret' && (
        <>
          {azureCloudOptions && (
            <Field
              label={t('azureauth.azure-credentials-form.label-azure-cloud', 'Azure Cloud')}
              htmlFor="azure-cloud-type"
              disabled={disabled}
            >
              <Select
                value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
                options={azureCloudOptions}
                onChange={onAzureCloudChange}
                isDisabled={disabled}
                inputId="azure-cloud-type"
                aria-label={t('azureauth.azure-credentials-form.aria-label-azure-cloud', 'Azure Cloud')}
                width={20}
              />
            </Field>
          )}
          <Field
            label={t('azureauth.azure-credentials-form.label-tenant-id', 'Directory (tenant) ID')}
            required
            htmlFor="tenant-id"
            invalid={!credentials.tenantId}
            error={t('azureauth.azure-credentials-form.required-tenant-id', 'Tenant ID is required')}
          >
            <Input
              width={45}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={credentials.tenantId || ''}
              onChange={onTenantIdChange}
              disabled={disabled}
              aria-label={t('azureauth.azure-credentials-form.aria-label-tenant-id', 'Tenant ID')}
            />
          </Field>
          <Field
            label={t('azureauth.azure-credentials-form.label-client-id', 'Application (client) ID')}
            required
            htmlFor="client-id"
            invalid={!credentials.clientId}
            error={t('azureauth.azure-credentials-form.required-client-id', 'Client ID is required')}
          >
            <Input
              width={45}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={credentials.clientId || ''}
              onChange={onClientIdChange}
              disabled={disabled}
              aria-label={t('azureauth.azure-credentials-form.arialabel-client-id', 'Client ID')}
            />
          </Field>
          {!disabled &&
            (typeof credentials.clientSecret === 'symbol' ? (
              <Field
                label={t('azureauth.azure-credentials-form.label-configured-client-secret', 'Client Secret')}
                htmlFor="client-secret"
                required
              >
                <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
                  <Input
                    aria-label={t(
                      'azureauth.azure-credentials-form.aria-label-configured-client-secret',
                      'Client Secret'
                    )}
                    placeholder={t(
                      'azureauth.azure-credentials-form.placeholder-configured-client-secret',
                      'configured'
                    )}
                    disabled={true}
                    data-testid={'client-secret'}
                    width={45}
                  />
                  <Button variant="secondary" type="button" onClick={onClientSecretReset} disabled={disabled}>
                    <Trans i18nKey="azureauth.azure-credentials-form.client-secret-reset">Reset</Trans>
                  </Button>
                </div>
              </Field>
            ) : (
              <Field
                label={t('azureauth.azure-credentials-form.label-client-secret', 'Client Secret')}
                required
                htmlFor="client-secret"
                invalid={!credentials.clientSecret}
                error={t('azureauth.azure-credentials-form.required-client-secret', 'Client secret is required')}
              >
                <Input
                  width={45}
                  aria-label={t('azureauth.azure-credentials-form.aria-label-client-secret', 'Client Secret')}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={credentials.clientSecret || ''}
                  onChange={onClientSecretChange}
                  id="client-secret"
                  disabled={disabled}
                />
              </Field>
            ))}
        </>
      )}
      {credentials.authType === 'ad-password' && azureEntraPasswordCredentialsEnabled && (
        <>
          <Field
            label={t('azureauth.azure-credentials-form.label-user-id', 'User Id')}
            required
            htmlFor="user-id"
            invalid={!credentials.userId}
            error={'User ID is required'}
          >
            <Input
              width={45}
              value={credentials.userId || ''}
              onChange={onUserIdChange}
              disabled={disabled}
              aria-label={t('azureauth.azure-credentials-form.aria-label-user-id', 'User ID')}
            />
          </Field>
          <Field
            label={t('azureauth.azure-credentials-form.label-application-client-id', 'Application Client ID')}
            required
            htmlFor="application-client-id"
            invalid={!credentials.clientId}
            error={t(
              'azureauth.azure-credentials-form.required-application-client-id',
              'Application Client ID is required'
            )}
          >
            <Input
              width={45}
              value={credentials.clientId || ''}
              onChange={onClientIdChange}
              disabled={disabled}
              aria-label={t(
                'azureauth.azure-credentials-form.aria-label-application-client-id',
                'Application Client ID'
              )}
            />
          </Field>
          {!disabled &&
            (typeof credentials.password === 'symbol' ? (
              <Field
                label={t('azureauth.azure-credentials-form.label-password-configured', 'Password')}
                htmlFor="password"
                required
              >
                <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
                  <Input
                    aria-label={t('azureauth.azure-credentials-form.aria-label-password-configured', 'Password')}
                    placeholder={t('azureauth.azure-credentials-form.placeholder-password-configured', 'configured')}
                    disabled={true}
                    data-testid={'password'}
                    width={45}
                  />
                  <Button variant="secondary" type="button" onClick={onPasswordReset} disabled={disabled}>
                    <Trans i18nKey="azureauth.azure-credentials-form.password-reset">Reset</Trans>
                  </Button>
                </div>
              </Field>
            ) : (
              <Field
                label={t('azureauth.azure-credentials-form.label-password', 'Password')}
                required
                htmlFor="password"
                invalid={!credentials.password}
                error={t('azureauth.azure-credentials-form.required-password', 'Password is required')}
              >
                <Input
                  width={45}
                  aria-label={t('azureauth.azure-credentials-form.aria-label-password', 'Password')}
                  value={credentials.password || ''}
                  onChange={onPasswordChange}
                  id="password"
                  disabled={disabled}
                />
              </Field>
            ))}
        </>
      )}
    </div>
  );
};

export default AzureCredentialsForm;
