import 'core-js/stable/structured-clone';
import { MemoryHistoryBuildOptions } from 'history';
import { ComponentProps, ReactNode } from 'react';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen, waitFor } from 'test/test-utils';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';

import { disablePlugin } from 'app/features/alerting/unified/mocks/server/configure';
import {
  setOnCallFeatures,
  setOnCallIntegrations,
} from 'app/features/alerting/unified/mocks/server/handlers/plugins/configure-plugins';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertmanagerConfigBuilder, setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { alertingFactory } from '../../../mocks/server/db';
import { captureRequests } from '../../../mocks/server/events';

import { GrafanaReceiverForm } from './GrafanaReceiverForm';

const renderWithProvider = (
  children: ReactNode,
  historyOptions?: MemoryHistoryBuildOptions,
  providerProps?: Partial<ComponentProps<typeof AlertmanagerProvider>>
) =>
  render(
    <AlertmanagerProvider accessType="notification" {...providerProps}>
      {children}
    </AlertmanagerProvider>,
    { historyOptions }
  );

const server = setupMswServer();

const ui = {
  typeSelector: byTestId('items.0.type'),
  loadingIndicator: byText('Loading notifiers...'),
  integrationType: byLabelText('Integration'),
  onCallIntegrationType: byRole('radiogroup'),
  integrationOption: {
    new: byRole('radio', {
      name: 'A new IRM integration without escalation chains will be automatically created',
    }),
    existing: byRole('radio', { name: 'Use an existing IRM integration' }),
  },
  newOnCallIntegrationName: byRole('textbox', { name: /Integration name/ }),
  existingOnCallIntegrationSelect: (index: number) => byTestId(`items.${index}.settings.url`),
  saveButton: byRole('button', { name: /save contact point/i }),
  slack: {
    recipient: byRole('textbox', { name: /^Recipient/ }),
    token: byRole('textbox', { name: /^Token/ }),
    webhookUrl: byRole('textbox', { name: /^Webhook URL/ }),
  },
  sns: {
    apiUrl: byRole('textbox', { name: /The Amazon SNS API URL/ }),
    region: byRole('textbox', { name: /^Region/ }),
    accessKey: byRole('textbox', { name: /^Access Key/ }),
    secretKey: byRole('textbox', { name: /^Secret Key/ }),
    topicArn: byRole('textbox', { name: /^SNS topic ARN/ }),
  },
  webhook: {
    url: byRole('textbox', { name: /^URL/ }),
    tlsConfig: {
      container: byTestId('items.0.settings.tlsConfig.container'),
      caCertificate: byRole('textbox', { name: /^CA Certificate/ }),
      clientCert: byRole('textbox', { name: /^Client Certificate/ }),
      clientKey: byRole('textbox', { name: /^Client Key/ }),
      deleteButton: byTestId('items.0.settings.tlsConfig.delete-button'),
    },
    httpConfig: {
      container: byTestId('items.0.settings.http_config.container'),
      oauth2: {
        container: byTestId('items.0.settings.http_config.oauth2.container'),
        clientSecret: byRole('textbox', { name: /^Client Secret/ }),
        tls_config: {
          container: byTestId('items.0.settings.http_config.oauth2.tls_config.container'),
          caCertificate: byRole('textbox', { name: /^CA Certificate/ }),
          clientCert: byRole('textbox', { name: /^Client Certificate/ }),
          clientKey: byRole('textbox', { name: /^Client Key/ }),
          deleteButton: byTestId('items.0.settings.http_config.oauth2.tls_config.delete-button'),
        },
      },
    },
    optionalSettings: byRole('button', { name: /optional webhook settings/i }),
  },
};

describe('GrafanaReceiverForm', () => {
  beforeAll(() => {
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    }));

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    });
  });

  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('handles nested secure fields correctly', async () => {
    const capturedRequests = captureRequests(
      (req) => req.url.includes('/v0alpha1/namespaces/default/receivers') && req.method === 'POST'
    );
    const { user } = renderWithProvider(<GrafanaReceiverForm />);
    const { type, click } = user;

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    // Select MQTT receiver and fill out basic required fields for contact point
    await clickSelectOption(ui.typeSelector.get(), 'MQTT');

    await type(screen.getByLabelText(/^name/i), 'mqtt contact point');
    await type(screen.getByLabelText(/broker url/i), 'broker url');
    await type(screen.getByLabelText(/topic/i), 'topic');

    // Fill out fields that we know will be nested secure fields
    await click(screen.getByText(/optional mqtt settings/i));
    await click(screen.getByRole('button', { name: /^Add$/i }));
    await type(screen.getByLabelText(/ca certificate/i), 'some cert');

    await click(ui.saveButton.get());

    const [request] = await capturedRequests;
    const postRequestbody = await request.clone().json();

    const integrationPayload = postRequestbody.spec.integrations[0];
    expect(integrationPayload.settings.tlsConfig).toEqual({
      // Expect the payload to have included the value of a secret field
      caCertificate: 'some cert',
      // And to not have removed other values (which would happen if we incorrectly merged settings together)
      insecureSkipVerify: false,
    });

    expect(postRequestbody).toMatchSnapshot();
  });

  describe('Slack contact point', () => {
    it('should disable webhook url field if the user typed the token', async () => {
      const { user } = renderWithProvider(<GrafanaReceiverForm />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      // Select Slack receiver
      await clickSelectOption(byTestId('items.0.type').get(), 'Slack');

      // Enter a value in the recipient field (required)
      await user.type(ui.slack.recipient.get(), 'my-channel');

      // Webhook URL field should be initially enabled
      const webhookUrlField = ui.slack.webhookUrl.get();
      expect(webhookUrlField).toBeEnabled();

      // Enter a token value
      const tokenField = ui.slack.token.get();
      await user.type(tokenField, 'xoxb-my-token');

      // Now the webhook URL field should be readonly
      expect(webhookUrlField).toHaveAttribute('readonly');
    });

    it('should disable token field if the user typed the webhook URL', async () => {
      const { user } = renderWithProvider(<GrafanaReceiverForm />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      // Select Slack receiver
      await clickSelectOption(byTestId('items.0.type').get(), 'Slack');

      // Token field should be initially enabled
      const tokenField = ui.slack.token.get();
      expect(tokenField).toBeEnabled();

      // Enter a webhook URL value
      const webhookUrlField = ui.slack.webhookUrl.get();
      await user.type(webhookUrlField, 'https://hooks.slack.com/services/T123456/B123456/abcdef123456');

      // Now the token field should be readonly
      expect(tokenField).toHaveAttribute('readonly');
    });

    it('should display token field as readonly with a Reset button when editing contact point with configured token', async () => {
      // Create mock config for a Slack contact point using token
      const contactPoint = alertingFactory.alertmanager.grafana.contactPoint
        .withIntegrations((integrationFactory) => [integrationFactory.slack({ token: 'xoxb-my-token' }).build()])
        .build();

      renderWithProvider(<GrafanaReceiverForm contactPoint={contactPoint} editMode={true} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      const tokenField = ui.slack.token.get();
      const webhookUrlField = ui.slack.webhookUrl.get();

      expect(tokenField).toHaveValue('configured');
      expect(tokenField).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();

      expect(webhookUrlField).toHaveValue('');
      expect(webhookUrlField).toHaveAttribute('readonly');
    });
    it('should display webhook URL field as readonly with a Reset button when editing existing contact point with configured webhook URL', async () => {
      // Create mock config for a Slack contact point using webhook
      const contactPoint = alertingFactory.alertmanager.grafana.contactPoint
        .withIntegrations((integrationFactory) => [
          integrationFactory.slack({ url: 'https://slack.example.com' }).build(),
        ])
        .build();

      renderWithProvider(<GrafanaReceiverForm contactPoint={contactPoint} editMode={true} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      const webhookField = ui.slack.webhookUrl.get();
      const tokenField = ui.slack.token.get();

      expect(webhookField).toHaveValue('configured');
      expect(webhookField).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();

      expect(tokenField).toHaveValue('');
      expect(tokenField).toHaveAttribute('readonly');
    });

    it('clicking the Reset button when editing a Slack contact point with webhook should make token field editable again', async () => {
      // Create mock config for a Slack contact point using webhook URL
      const contactPoint = alertingFactory.alertmanager.grafana.contactPoint
        .withIntegrations((integrationFactory) => [
          integrationFactory.slack({ url: 'https://slack.example.com' }).build(),
        ])
        .build();

      const { user } = renderWithProvider(<GrafanaReceiverForm contactPoint={contactPoint} editMode={true} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      // Initially, the token field should be readonly
      expect(ui.slack.token.get()).toHaveAttribute('readonly');

      // Find and click the Reset button
      const resetButton = screen.getByRole('button', { name: 'Reset' });
      await user.click(resetButton);

      // After resetting the webhook URL, the token field should be editable
      expect(ui.slack.token.get()).not.toHaveAttribute('readonly');

      // And we should be able to enter a token value
      await user.type(ui.slack.token.get(), 'xoxb-new-token');
    });
  });

  describe('SNS contact point', () => {
    it('should handle secure fields correctly when editing contact point', async () => {
      // Create mock config for an SNS contact point with secure fields configured
      const contactPointName = 'amazon-sns';
      const contactPoint = alertingFactory.alertmanager.grafana.contactPoint
        .withIntegrations((integrationFactory) => [
          integrationFactory
            .sns({
              api_url: 'https://amazon.example.com:1234',
              sigv4: { region: 'us-east-1', access_key: 'access-key', secret_key: 'secret-key' },
            })
            .build(),
        ])
        .build({ id: 'amazon-sns-id', name: contactPointName, metadata: { name: contactPointName } });

      const capture = captureRequests(
        (req) => req.url.includes(`/v0alpha1/namespaces/default/receivers/${contactPoint.id}`) && req.method === 'PUT'
      );

      const { user } = renderWithProvider(<GrafanaReceiverForm contactPoint={contactPoint} editMode={true} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      const apiUrlField = await ui.sns.apiUrl.find();
      const regionField = await ui.sns.region.find();
      const accessKeyField = await ui.sns.accessKey.find();
      const secretKeyField = await ui.sns.secretKey.find();

      expect(apiUrlField).toHaveValue('https://amazon.example.com:1234');
      expect(regionField).toHaveValue('us-east-1');
      expect(accessKeyField).toHaveValue('configured');
      expect(accessKeyField).toBeDisabled();
      expect(secretKeyField).toHaveValue('configured');
      expect(secretKeyField).toBeDisabled();

      // There should be a Reset button for secure fields
      const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
      expect(resetButtons).toHaveLength(2);

      // Reset and update access key
      await user.click(resetButtons[0]); // Reset access key
      expect(ui.sns.accessKey.get()).toBeEnabled();
      expect(ui.sns.accessKey.get()).toHaveValue('');
      await user.type(ui.sns.accessKey.get(), 'new-access-key');
      await user.type(ui.sns.topicArn.get(), 'arn:aws:sns:us-east-1:123456789012:MyTopic');

      await user.click(ui.saveButton.get());

      const requests = await capture;
      expect(requests).toHaveLength(1);

      const [request] = requests;
      const postRequestBody = await request.clone().json();

      const integrationPayload = postRequestBody.spec.integrations[0];

      // Verify that secureFields object correctly reflects which fields were reset
      expect(integrationPayload.secureFields).toEqual({
        'sigv4.secret_key': true, // Should remain true as we didn't reset it
      });
      // The access key should not be in the secureFields object as it was reset
      expect(integrationPayload.secureFields).not.toHaveProperty('sigv4.access_key');

      // Verify that the new access key value is included in the settings
      expect(integrationPayload.settings).toEqual({
        api_url: 'https://amazon.example.com:1234',
        sigv4: {
          access_key: 'new-access-key',
          region: 'us-east-1',
        },
        topic_arn: 'arn:aws:sns:us-east-1:123456789012:MyTopic',
      });

      expect(postRequestBody).toMatchSnapshot();
    });
  });

  describe('OnCall contact point', () => {
    it('OnCall contact point should be disabled if OnCall integration is not enabled', async () => {
      disablePlugin(SupportedPlugin.OnCall);

      renderWithProvider(<GrafanaReceiverForm />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(ui.typeSelector.get(), 'Grafana IRM');
      // Clicking on a disable element shouldn't change the form value. email is the default value
      // eslint-disable-next-line testing-library/no-node-access
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'email' });

      await clickSelectOption(ui.typeSelector.get(), 'Alertmanager');
      // eslint-disable-next-line testing-library/no-node-access
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'prometheus-alertmanager' });
    });

    it('OnCall contact point should support new and existing integration options if OnCall integration V2 is enabled', async () => {
      setOnCallIntegrations([
        { display_name: 'nasa-oncall', value: 'nasa-oncall', integration_url: 'https://nasa.oncall.example.com' },
        { display_name: 'apac-oncall', value: 'apac-oncall', integration_url: 'https://apac.oncall.example.com' },
      ]);

      const { user } = renderWithProvider(<GrafanaReceiverForm />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(ui.typeSelector.get(), 'Grafana IRM');

      // eslint-disable-next-line testing-library/no-node-access
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'oncall' });
      expect(ui.onCallIntegrationType.get()).toBeInTheDocument();

      const newIntegrationRadio = ui.integrationOption.new;
      const existingIntegrationRadio = ui.integrationOption.existing;

      expect(newIntegrationRadio.get()).toBeInTheDocument();
      expect(existingIntegrationRadio.get()).toBeInTheDocument();

      await user.click(newIntegrationRadio.get());
      expect(newIntegrationRadio.get()).toBeChecked();

      await user.type(ui.newOnCallIntegrationName.get(), 'emea-oncall');

      // eslint-disable-next-line testing-library/no-node-access
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({
        'items.0.settings.integration_type': 'new_oncall_integration',
        'items.0.settings.integration_name': 'emea-oncall',
        'items.0.settings.url_name': undefined,
      });

      await user.click(existingIntegrationRadio.get());
      expect(existingIntegrationRadio.get()).toBeChecked();

      await clickSelectOption(ui.existingOnCallIntegrationSelect(0).get(), 'apac-oncall');

      // eslint-disable-next-line testing-library/no-node-access
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({
        'items.0.settings.url': 'https://apac.oncall.example.com',
        'items.0.settings.integration_name': undefined,
      });
    });

    it('Should render URL text input field for OnCall concact point if OnCall plugin uses legacy integration', async () => {
      setOnCallFeatures([]);
      setOnCallIntegrations([]);

      const amConfig = getAmCortexConfig((config) =>
        config.addReceivers((receiver) =>
          receiver.addGrafanaReceiverConfig((receiverConfig) =>
            receiverConfig.withType('oncall').withName('emea-oncall').addSetting('url', 'https://oncall.example.com')
          )
        )
      );

      renderWithProvider(<GrafanaReceiverForm contactPoint={amConfig.alertmanager_config.receivers![0]} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      expect(byTestId('items.0.type').get()).toHaveTextContent('Grafana IRM');
      expect(byLabelText('URL').get()).toHaveValue('https://oncall.example.com');
    });
  });

  describe('Webhook contact point', () => {
    it('should mark secure fields as configured when values exist', async () => {
      const contactPointName = 'webhook-test';
      const contactPoint = alertingFactory.alertmanager.grafana.contactPoint
        .withIntegrations((integrationFactory) => [
          integrationFactory
            .webhook()
            .params({
              settings: {
                url: 'http://example.com',
                tlsConfig: {
                  insecureSkipVerify: false,
                },
                http_config: {
                  oauth2: {
                    client_id: 'client-id',
                    token_url: 'http://example.com/oauth2/token',
                    scopes: ['scope1', 'scope2'],
                    endpoint_params: {
                      param1: 'value1',
                      param2: 'value2',
                    },
                    tls_config: {
                      insecureSkipVerify: false,
                    },
                    proxy_config: {
                      proxy_url: 'http://example.com/proxy',
                      no_proxy: 'example.com',
                      proxy_from_environment: true,
                      proxy_connect_header: {
                        'X-Custom-Header': 'custom-value',
                      },
                    },
                  },
                },
              },
              secureFields: {
                'tlsConfig.caCertificate': true,
                'tlsConfig.clientCertificate': true,
                'tlsConfig.clientKey': true,
                'http_config.oauth2.client_secret': true,
                'http_config.oauth2.tls_config.caCertificate': true,
                'http_config.oauth2.tls_config.clientCertificate': true,
                'http_config.oauth2.tls_config.clientKey': true,
              },
            })
            .build(),
        ])
        .build({ id: 'webhook-id', name: contactPointName, metadata: { name: contactPointName } });

      const { user } = renderWithProvider(<GrafanaReceiverForm contactPoint={contactPoint} editMode={true} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());
      await waitFor(() => expect(ui.webhook.optionalSettings.query()).toBeInTheDocument());
      await user.click(ui.webhook.optionalSettings.get());

      const tlsContainer = await ui.webhook.tlsConfig.container.find();
      const caCertField = ui.webhook.tlsConfig.caCertificate.get(tlsContainer);
      const clientCertField = ui.webhook.tlsConfig.clientCert.get(tlsContainer);
      const clientKeyField = ui.webhook.tlsConfig.clientKey.get(tlsContainer);
      expect(caCertField).toHaveValue('configured');
      expect(clientCertField).toHaveValue('configured');
      expect(clientKeyField).toHaveValue('configured');

      // Deeply nested secure fields.
      const oauth2Container = await ui.webhook.httpConfig.oauth2.container.find();
      const clientSecretField = ui.webhook.httpConfig.oauth2.clientSecret.get(oauth2Container);
      const oauthCaCertField = ui.webhook.httpConfig.oauth2.tls_config.caCertificate.get(oauth2Container);
      const oauthClientCertField = ui.webhook.httpConfig.oauth2.tls_config.clientCert.get(oauth2Container);
      const oauthClientKeyField = ui.webhook.httpConfig.oauth2.tls_config.clientKey.get(oauth2Container);
      expect(clientSecretField).toHaveValue('configured');
      expect(oauthCaCertField).toHaveValue('configured');
      expect(oauthClientCertField).toHaveValue('configured');
      expect(oauthClientKeyField).toHaveValue('configured');
    });

    it('should properly remove TLS config when deleted', async () => {
      const contactPointName = 'webhook-test';
      const contactPoint = alertingFactory.alertmanager.grafana.contactPoint
        .withIntegrations((integrationFactory) => [
          integrationFactory
            .webhook()
            .params({
              settings: {
                url: 'http://example.com',
                tlsConfig: {
                  caCertificate: 'ca-cert',
                  clientCertificate: 'client-cert',
                  clientKey: 'client-key',
                  insecureSkipVerify: false,
                },
                http_config: {
                  oauth2: {
                    client_id: 'client-id',
                    token_url: 'http://example.com/oauth2/token',
                    scopes: ['scope1', 'scope2'],
                    endpoint_params: {
                      param1: 'value1',
                      param2: 'value2',
                    },
                    tls_config: {
                      // This tls config has existing values via secureFields, delete should remove this correctly as well.
                      insecureSkipVerify: false,
                    },
                    proxy_config: {
                      proxy_url: 'http://example.com/proxy',
                      no_proxy: 'example.com',
                      proxy_from_environment: true,
                      proxy_connect_header: {
                        'X-Custom-Header': 'custom-value',
                      },
                    },
                  },
                },
              },
              secureFields: {
                'http_config.oauth2.client_secret': true,
                'http_config.oauth2.tls_config.caCertificate': true,
                'http_config.oauth2.tls_config.clientCertificate': true,
                'http_config.oauth2.tls_config.clientKey': true,
              },
            })
            .build(),
        ])
        .build({ id: 'webhook-id', name: contactPointName, metadata: { name: contactPointName } });

      const capture = captureRequests(
        (req) => req.url.includes(`/v0alpha1/namespaces/default/receivers/${contactPoint.id}`) && req.method === 'PUT'
      );

      const { user } = renderWithProvider(<GrafanaReceiverForm contactPoint={contactPoint} editMode={true} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      // Find and click the delete button next to TLS config
      await user.click(ui.webhook.optionalSettings.get());

      // Delete new tlsConfig values.
      expect(await ui.webhook.tlsConfig.container.find()).toBeInTheDocument();
      await user.click(await ui.webhook.tlsConfig.deleteButton.find());

      // Delete existing oauth2 values.
      expect(await ui.webhook.httpConfig.oauth2.tls_config.container.find()).toBeInTheDocument();
      await user.click(await ui.webhook.httpConfig.oauth2.tls_config.deleteButton.find());

      await user.click(ui.saveButton.get());

      const requests = await capture;
      expect(requests).toHaveLength(1);

      const [request] = requests;
      const postRequestBody = await request.clone().json();

      const integrationPayload = postRequestBody.spec.integrations[0];

      // Verify that TLS config is not present in the settings
      expect(integrationPayload.settings).not.toHaveProperty('tlsConfig');
      expect(integrationPayload.secureFields).not.toHaveProperty('tlsConfig.caCertificate');
      expect(integrationPayload.secureFields).not.toHaveProperty('tlsConfig.clientCert');
      expect(integrationPayload.secureFields).not.toHaveProperty('tlsConfig.clientKey');

      // Verify that OAuth2 TLS config is not present in the settings
      expect(integrationPayload.settings).not.toHaveProperty('http_config.oauth2.tls_config');
      expect(integrationPayload.secureFields).not.toHaveProperty('http_config.oauth2.tls_config.caCertificate');
      expect(integrationPayload.secureFields).not.toHaveProperty('http_config.oauth2.tls_config.clientCert');
      expect(integrationPayload.secureFields).not.toHaveProperty('http_config.oauth2.tls_config.clientKey');

      expect(postRequestBody).toMatchSnapshot();
    });
  });
});

function getAmCortexConfig(configure: (builder: AlertmanagerConfigBuilder) => void): AlertManagerCortexConfig {
  const configBuilder = new AlertmanagerConfigBuilder();
  configure(configBuilder);

  return {
    alertmanager_config: configBuilder.build(),
    template_files: {},
  };
}
