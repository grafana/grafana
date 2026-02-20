import { ChangeEvent } from 'react';

import {
  AzureClientCertificateCredentials,
  AzureClientSecretCredentials,
  AzureCredentials,
  CertificateFormat,
} from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, SecretTextArea, Select } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';

export interface AppRegistrationCredentialsProps {
  credentials: AzureClientSecretCredentials | AzureClientCertificateCredentials;
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

  return (
    <>
      {azureCloudOptions && (
        <Field
          label={t('components.app-registration-credentials.label-azure-cloud', 'Azure Cloud')}
          data-testid={selectors.components.configEditor.azureCloud.input}
          htmlFor="azure-cloud-type"
          disabled={disabled}
          noMargin
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
        noMargin
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
        noMargin
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
      {credentials.authType === 'clientsecret' && (
        <AppRegistrationClientSecretCredentials
          disabled={disabled || false}
          credentials={credentials}
          onCredentialsChange={onCredentialsChange}
        />
      )}
      {credentials.authType === 'clientcertificate' && (
        <AppRegistrationClientCertificateCredentials
          disabled={disabled || false}
          credentials={credentials}
          onCredentialsChange={onCredentialsChange}
        />
      )}
    </>
  );
};

const AppRegistrationClientSecretCredentials = ({
  disabled,
  credentials,
  onCredentialsChange,
}: {
  disabled: boolean;
  credentials: AzureClientSecretCredentials;
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
}) => {
  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const updated: AzureClientSecretCredentials = {
      ...credentials,
      authType: 'clientsecret',
      clientSecret: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onClientSecretReset = () => {
    const updated: AzureClientSecretCredentials = {
      ...credentials,
      authType: 'clientsecret',
      clientSecret: '',
    };
    onCredentialsChange(updated);
  };

  return (
    <>
      {!disabled &&
        (typeof credentials.clientSecret === 'symbol' ? (
          <Field
            label={t('components.app-registration-credentials.label-symbol-client-secret', 'Client Secret')}
            htmlFor="client-secret"
            required
            noMargin
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
            noMargin
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

const AppRegistrationClientCertificateCredentials = ({
  disabled,
  credentials,
  onCredentialsChange,
}: {
  disabled: boolean;
  credentials: AzureClientCertificateCredentials;
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
}) => {
  const onCertificateFormatChange = (selected: SelectableValue<CertificateFormat>) => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      certificateFormat: selected.value,
    };
    onCredentialsChange(updated);
  };

  const onClientCertificateChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      clientCertificate: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onClientCertificateReset = () => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      clientCertificate: '',
    };
    onCredentialsChange(updated);
  };
  const onPrivateKeyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      privateKey: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onPrivateKeyReset = () => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      privateKey: '',
    };
    onCredentialsChange(updated);
  };
  const onCertificatePasswordChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      certificatePassword: event.target.value,
    };
    onCredentialsChange(updated);
  };

  const onCertificatePasswordReset = () => {
    const updated: AzureClientCertificateCredentials = {
      ...credentials,
      certificatePassword: '',
    };
    onCredentialsChange(updated);
  };

  const certificateFormatOptions = [
    { label: 'PEM', value: CertificateFormat.PEM },
    { label: 'PFX', value: CertificateFormat.PFX },
  ];

  return (
    <>
      <Field
        label={t('components.app-registration-credentials.label-certificate-format', 'Format')}
        description={t(
          'components.app-registration-credentials.description-certificate-format',
          'Choose the format of the certificate (PEM certificates should be in plain text PEM format, PFX certificates should be in base64 encoded PFX format)'
        )}
        data-testid={selectors.components.configEditor.certificateFormat.select}
        htmlFor="certificate-format"
        noMargin
      >
        <Select
          className="width-15"
          value={certificateFormatOptions.find((opt) => opt.value === credentials.certificateFormat)}
          options={certificateFormatOptions}
          onChange={onCertificateFormatChange}
          disabled={disabled}
        />
      </Field>
      {!disabled && credentials.certificateFormat && (
        <Field
          label={t('components.app-registration-credentials.label-client-certificate', 'Client Certificate')}
          data-testid={selectors.components.configEditor.clientCertificate.input}
          required
          htmlFor="client-certificate"
          invalid={!credentials.clientCertificate}
          error={'Client certificate is required'}
          noMargin
        >
          <SecretTextArea
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="-----BEGIN CERTIFICATE-----"
            cols={45}
            rows={7}
            className="width-30"
            aria-label={t(
              'components.app-registration-credentials.aria-label-client-certificate',
              'Client Certificate'
            )}
            onChange={onClientCertificateChange}
            id="client-certificate"
            disabled={disabled}
            isConfigured={typeof credentials.clientCertificate === 'symbol'}
            onReset={onClientCertificateReset}
          />
        </Field>
      )}
      {!disabled && credentials.certificateFormat === CertificateFormat.PEM && (
        <Field
          label={t('components.app-registration-credentials.label-private-key', 'Private Key')}
          data-testid={selectors.components.configEditor.privateKey.input}
          required
          htmlFor="private-key"
          invalid={!credentials.privateKey}
          error={'Private key is required'}
          noMargin
        >
          <SecretTextArea
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="-----BEGIN PRIVATE KEY-----"
            cols={45}
            rows={7}
            className="width-30"
            aria-label={t('components.app-registration-credentials.aria-label-private-key', 'Private Key')}
            onChange={onPrivateKeyChange}
            id="private-key"
            disabled={disabled}
            isConfigured={typeof credentials.privateKey === 'symbol'}
            onReset={onPrivateKeyReset}
          />
        </Field>
      )}
      {!disabled && credentials.certificateFormat === CertificateFormat.PFX && (
        <Field
          label={t('components.app-registration-credentials.label-symbol-private-key-password', 'Certificate Password')}
          htmlFor="private-key-password"
          noMargin
        >
          <SecretTextArea
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            cols={45}
            rows={1}
            className="width-30"
            aria-label={t(
              'components.app-registration-credentials.aria-label-private-key-password',
              'Certificate Password'
            )}
            onChange={onCertificatePasswordChange}
            id="private-key-password"
            disabled={disabled}
            isConfigured={typeof credentials.certificatePassword === 'symbol'}
            onReset={onCertificatePasswordReset}
          />
        </Field>
      )}
    </>
  );
};
