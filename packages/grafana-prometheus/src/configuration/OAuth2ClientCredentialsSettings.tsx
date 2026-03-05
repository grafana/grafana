import {
  DataSourceSettings,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Field, Input, SecretInput } from '@grafana/ui';

import { PromOptions } from '../types';

type Props = {
  options: DataSourceSettings<PromOptions>;
  onOptionsChange: (options: DataSourceSettings<PromOptions>) => void;
};

export const OAuth2ClientCredentialsSettings = ({ options, onOptionsChange }: Props) => {
  return (
    <div data-testid="oauth2-client-credentials-settings">
      <Field
        label={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.client-id-label">Client ID</Trans>
        }
        description={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.client-id-description">
            The OAuth2 client identifier
          </Trans>
        }
      >
        <Input
          id="oauth2-client-id"
          width={40}
          value={options.jsonData.oauth2ClientId || ''}
          onChange={onUpdateDatasourceJsonDataOption(
            { options, onOptionsChange } as { options: DataSourceSettings<PromOptions>; onOptionsChange: (options: DataSourceSettings<PromOptions>) => void },
            'oauth2ClientId'
          )}
          placeholder="Enter Client ID"
        />
      </Field>

      <Field
        label={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.client-secret-label">
            Client Secret
          </Trans>
        }
        description={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.client-secret-description">
            The OAuth2 client secret (stored securely)
          </Trans>
        }
      >
        <SecretInput
          id="oauth2-client-secret"
          width={40}
          isConfigured={!!options.secureJsonFields?.oauth2ClientSecret}
          onReset={() => updateDatasourcePluginResetOption({ options, onOptionsChange } as any, 'oauth2ClientSecret')}
          onChange={onUpdateDatasourceSecureJsonDataOption(
            { options, onOptionsChange } as any,
            'oauth2ClientSecret'
          )}
          placeholder="Enter Client Secret"
        />
      </Field>

      <Field
        label={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.token-url-label">Token URL</Trans>
        }
        description={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.token-url-description">
            The URL of the OAuth2 token endpoint
          </Trans>
        }
      >
        <Input
          id="oauth2-token-url"
          width={40}
          value={options.jsonData.oauth2TokenUrl || ''}
          onChange={onUpdateDatasourceJsonDataOption(
            { options, onOptionsChange } as { options: DataSourceSettings<PromOptions>; onOptionsChange: (options: DataSourceSettings<PromOptions>) => void },
            'oauth2TokenUrl'
          )}
          placeholder="https://auth.example.com/oauth2/token"
        />
      </Field>

      <Field
        label={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.scopes-label">Scopes</Trans>
        }
        description={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.scopes-description">
            Comma-separated list of OAuth2 scopes (optional)
          </Trans>
        }
      >
        <Input
          id="oauth2-scopes"
          width={40}
          value={options.jsonData.oauth2Scopes || ''}
          onChange={onUpdateDatasourceJsonDataOption(
            { options, onOptionsChange } as { options: DataSourceSettings<PromOptions>; onOptionsChange: (options: DataSourceSettings<PromOptions>) => void },
            'oauth2Scopes'
          )}
          placeholder="read, write"
        />
      </Field>

      <Field
        label={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.endpoint-params-label">
            Endpoint Parameters
          </Trans>
        }
        description={
          <Trans i18nKey="grafana-prometheus.configuration.oauth2-client-credentials.endpoint-params-description">
            Additional parameters for the token request in query string format (optional, e.g.
            audience=https://api.example.com)
          </Trans>
        }
      >
        <Input
          id="oauth2-endpoint-params"
          width={40}
          value={options.jsonData.oauth2EndpointParams || ''}
          onChange={onUpdateDatasourceJsonDataOption(
            { options, onOptionsChange } as { options: DataSourceSettings<PromOptions>; onOptionsChange: (options: DataSourceSettings<PromOptions>) => void },
            'oauth2EndpointParams'
          )}
          placeholder="audience=https://api.example.com&resource=my-resource"
        />
      </Field>
    </div>
  );
};
