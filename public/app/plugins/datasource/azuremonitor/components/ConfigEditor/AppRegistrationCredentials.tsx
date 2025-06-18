import { ChangeEvent } from 'react';

import { AzureClientSecretCredentials, AzureCredentials } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, Select, Input, Button } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';

export interface AppRegistrationCredentialsProps {
  credentials: AzureClientSecretCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
}

export const AppRegistrationCredentials = (props: AppRegistrationCredentialsProps) => {
  const { azureCloudOptions, disabled, credentials, onCredentialsChange } = props;

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    const updated: AzureCredentials = {
      ...credentials,
      azureCloud: selected.value,
    };
    onCredentialsChange(updated);
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const updated: AzureCredentials = {
      ...credentials,
      tenantId: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const updated: AzureCredentials = {
      ...credentials,
      clientId: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const updated: AzureCredentials = {
      ...credentials,
      clientSecret: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onClientSecretReset = () => {
    const updated: AzureCredentials = {
      ...credentials,
      clientSecret: '',
    };
    onCredentialsChange(updated);
  };

  return (
    <>
      {azureCloudOptions && (
        <Field
          label={t('components.app-registration-credentials.label-azure-cloud', 'Azure Cloud')}
          data-testid={selectors.components.configEditor.azureCloud.input}
          htmlFor="azure-cloud-type"
          disabled={disabled}
        >
          <Select
            inputId="azure-cloud-type"
            aria-label={t('components.app-registration-credentials.aria-label-azure-cloud', 'Azure Cloud')}
            className="width-15"
            value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
            options={azureCloudOptions}
            onChange={onAzureCloudChange}
          />
        </Field>
      )}
      <Field
        label={t('components.app-registration-credentials.label-tenant-id', 'Directory (tenant) ID')}
        required={credentials.authType === 'clientsecret'}
        data-testid={selectors.components.configEditor.tenantID.input}
        htmlFor="tenant-id"
        invalid={credentials.authType === 'clientsecret' && !credentials.tenantId}
        error={'Tenant ID is required'}
      >
        <Input
          aria-label={t('components.app-registration-credentials.aria-label-tenant-id', 'Tenant ID')}
          className="width-30"
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          value={credentials.tenantId || ''}
          onChange={onTenantIdChange}
          disabled={disabled}
        />
      </Field>
      <Field
        label={t('components.app-registration-credentials.label-client-id', 'Application (client) ID')}
        required={credentials.authType === 'clientsecret'}
        data-testid={selectors.components.configEditor.clientID.input}
        htmlFor="client-id"
        invalid={credentials.authType === 'clientsecret' && !credentials.clientId}
        error={'Client ID is required'}
      >
        <Input
          className="width-30"
          aria-label={t('components.app-registration-credentials.aria-label-client-id', 'Client ID')}
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          value={credentials.clientId || ''}
          onChange={onClientIdChange}
          disabled={disabled}
        />
      </Field>
      {!disabled &&
        (typeof credentials.clientSecret === 'symbol' ? (
          <Field
            label={t('components.app-registration-credentials.label-symbol-client-secret', 'Client Secret')}
            htmlFor="client-secret"
            required
          >
            <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
              <Input
                aria-label={t(
                  'components.app-registration-credentials.aria-label-symbol-client-secret',
                  'Client Secret'
                )}
                placeholder={t(
                  'components.app-registration-credentials.placeholder-symbol-client-secret',
                  'configured'
                )}
                disabled={true}
                data-testid={'client-secret'}
              />
              <Button variant="secondary" type="button" onClick={onClientSecretReset} disabled={disabled}>
                <Trans i18nKey="components.app-registration-credentials.reset-symbol-client-secret">Reset</Trans>
              </Button>
            </div>
          </Field>
        ) : (
          <Field
            label={t('components.app-registration-credentials.label-client-secret', 'Client Secret')}
            data-testid={selectors.components.configEditor.clientSecret.input}
            required
            htmlFor="client-secret"
            invalid={!credentials.clientSecret}
            error={'Client secret is required'}
          >
            <Input
              className="width-30"
              aria-label={t('components.app-registration-credentials.aria-label-client-secret', 'Client Secret')}
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
  );
};
