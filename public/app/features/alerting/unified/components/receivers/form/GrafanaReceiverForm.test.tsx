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
import { AccessControlAction } from 'app/types';

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

setupMswServer();

const ui = {
  type: byRole('combobox', { name: /Integration/ }),
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
  slack: {
    recipient: byRole('textbox', { name: /^Recipient/ }),
    token: byRole('textbox', { name: /^Token/ }),
    webhookUrl: byRole('textbox', { name: /^Webhook URL/ }),
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

  it('handles nested secure fields correctly', async () => {
    const capturedRequests = captureRequests(
      (req) => req.url.includes('/v0alpha1/namespaces/default/receivers') && req.method === 'POST'
    );
    const { user } = renderWithProvider(<GrafanaReceiverForm />);
    const { type, click } = user;

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    // Select MQTT receiver and fill out basic required fields for contact point
    await type(await ui.type.find(), 'MQTT');
    await click(await screen.findByRole('option', { name: 'MQTT' }));

    await type(screen.getByLabelText(/^name/i), 'mqtt contact point');
    await type(screen.getByLabelText(/broker url/i), 'broker url');
    await type(screen.getByLabelText(/topic/i), 'topic');

    // Fill out fields that we know will be nested secure fields
    await click(screen.getByText(/optional mqtt settings/i));
    await click(screen.getByRole('button', { name: /^Add$/i }));
    await type(screen.getByLabelText(/ca certificate/i), 'some cert');

    await click(screen.getByRole('button', { name: /save contact point/i }));

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

  describe('OnCall contact point', () => {
    it('OnCall contact point should be disabled if OnCall integration is not enabled', async () => {
      disablePlugin(SupportedPlugin.OnCall);

      renderWithProvider(<GrafanaReceiverForm />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');
      // Clicking on a disable element shouldn't change the form value. email is the default value
      // eslint-disable-next-line testing-library/no-node-access
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'email' });

      await clickSelectOption(byTestId('items.0.type').get(), 'Alertmanager');
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

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');

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

      expect(byTestId('items.0.type').get()).toHaveTextContent('Grafana OnCall');
      expect(byLabelText('URL').get()).toHaveValue('https://oncall.example.com');
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
