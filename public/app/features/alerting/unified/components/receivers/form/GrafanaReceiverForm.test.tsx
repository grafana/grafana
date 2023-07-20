import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';

import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerConfigBuilder, mockApi, setupMswServer } from '../../../mockApi';
import { grafanaAlertNotifiersMock } from '../../../mockGrafanaNotifiers';
import { onCallPluginMetaMock } from '../../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { GRAFANA_ONCALL_INTEGRATION_TYPE } from '../grafanaAppReceivers/onCall/useOnCallIntegration';

import { GrafanaReceiverForm } from './GrafanaReceiverForm';

import 'core-js/stable/structured-clone';

const server = setupMswServer();

const ui = {
  loadingIndicator: byText('Loading notifiers...'),
  integrationType: byLabelText('Integration'),
  onCallIntegrationType: byRole('radiogroup'),
  integrationOption: {
    new: byRole('radio', {
      name: 'A new OnCall integration without escalation chains will be automatically created',
    }),
    existing: byRole('radio', { name: 'Use an existing OnCall integration' }),
  },
  newOnCallIntegrationName: byRole('textbox', { name: /Integration name/ }),
  existingOnCallIntegrationSelect: (index: number) => byTestId(`items.${index}.settings.url`),
};

describe('GrafanaReceiverForm', () => {
  beforeEach(() => {
    server.resetHandlers();
    clearPluginSettingsCache();
  });

  describe('OnCall contact point', () => {
    it('OnCall contact point should be disabled if OnCall integration is not enabled', async () => {
      mockApi(server).grafanaNotifiers(grafanaAlertNotifiersMock);
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: false });

      const amConfig = getAmCortexConfig((_) => {});

      render(<GrafanaReceiverForm alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME} config={amConfig} />, {
        wrapper: TestProvider,
      });

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');
      // Clicking on a disable element shouldn't change the form value. email is the default value
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'email' });

      await clickSelectOption(byTestId('items.0.type').get(), 'Alertmanager');
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'prometheus-alertmanager' });
    });

    it('OnCall contact point should be support new and existing integration options if OnCall integration V2 is enabled', async () => {
      mockApi(server).grafanaNotifiers(grafanaAlertNotifiersMock);
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.getOnCallIntegrations([
        (i) =>
          i
            .withIntegration(GRAFANA_ONCALL_INTEGRATION_TYPE)
            .withVerbalName('nasa-oncall')
            .withIntegrationUrl('https://nasa.oncall.example.com'),
        (i) =>
          i
            .withIntegration(GRAFANA_ONCALL_INTEGRATION_TYPE)
            .withVerbalName('apac-oncall')
            .withIntegrationUrl('https://apac.oncall.example.com'),
      ]);

      const amConfig = getAmCortexConfig((_) => {});

      const user = userEvent.setup();

      render(<GrafanaReceiverForm alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME} config={amConfig} />, {
        wrapper: TestProvider,
      });

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');

      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'oncall' });
      expect(ui.onCallIntegrationType.get()).toBeInTheDocument();

      const newIntegrationRadio = ui.integrationOption.new;
      const existingIntegrationRadio = ui.integrationOption.existing;

      expect(newIntegrationRadio.get()).toBeInTheDocument();
      expect(existingIntegrationRadio.get()).toBeInTheDocument();

      await user.click(newIntegrationRadio.get());
      expect(newIntegrationRadio.get()).toBeChecked();

      await user.type(ui.newOnCallIntegrationName.get(), 'emea-oncall');

      expect(ui.integrationType.get().closest('form')).toHaveFormValues({
        'items.0.settings.integration_type': 'new_oncall_integration',
        'items.0.settings.integration_name': 'emea-oncall',
        'items.0.settings.url_name': undefined,
      });

      await user.click(existingIntegrationRadio.get());
      expect(existingIntegrationRadio.get()).toBeChecked();

      await clickSelectOption(ui.existingOnCallIntegrationSelect(0).get(), 'apac-oncall');

      expect(ui.integrationType.get().closest('form')).toHaveFormValues({
        'items.0.settings.url': 'https://apac.oncall.example.com',
        'items.0.settings.integration_name': undefined,
      });
    });

    it('Should render URL text input field for OnCall concact point if OnCall plugin uses legacy integration', async () => {
      mockApi(server).grafanaNotifiers(grafanaAlertNotifiersMock);
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.getOnCallIntegrations([]);

      const amConfig = getAmCortexConfig((config) =>
        config.addReceivers((receiver) =>
          receiver.addGrafanaReceiverConfig((receiverConfig) =>
            receiverConfig.withType('oncall').withName('emea-oncall').addSetting('url', 'https://oncall.example.com')
          )
        )
      );

      render(
        <GrafanaReceiverForm
          alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
          config={amConfig}
          existing={amConfig.alertmanager_config.receivers![0]}
        />,
        {
          wrapper: TestProvider,
        }
      );

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
