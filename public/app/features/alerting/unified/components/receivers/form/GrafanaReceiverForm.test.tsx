import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, waitFor, userEvent } from 'test/test-utils';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';

import { disablePlugin } from 'app/features/alerting/unified/mocks/server/configure';
import {
  setOnCallFeatures,
  setOnCallIntegrations,
} from 'app/features/alerting/unified/mocks/server/handlers/plugins/configure-plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerConfigBuilder, setupMswServer } from '../../../mockApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import { GrafanaReceiverForm } from './GrafanaReceiverForm';

import 'core-js/stable/structured-clone';

setupMswServer();

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
    clearPluginSettingsCache();
  });

  describe('OnCall contact point', () => {
    it('OnCall contact point should be disabled if OnCall integration is not enabled', async () => {
      disablePlugin(SupportedPlugin.OnCall);

      const amConfig = getAmCortexConfig((_) => {});

      render(<GrafanaReceiverForm alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME} config={amConfig} />);

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');
      // Clicking on a disable element shouldn't change the form value. email is the default value
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'email' });

      await clickSelectOption(byTestId('items.0.type').get(), 'Alertmanager');
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'prometheus-alertmanager' });
    });

    it('OnCall contact point should support new and existing integration options if OnCall integration V2 is enabled', async () => {
      setOnCallIntegrations([
        { display_name: 'nasa-oncall', value: 'nasa-oncall', integration_url: 'https://nasa.oncall.example.com' },
        { display_name: 'apac-oncall', value: 'apac-oncall', integration_url: 'https://apac.oncall.example.com' },
      ]);

      const amConfig = getAmCortexConfig((_) => {});

      const user = userEvent.setup();

      render(<GrafanaReceiverForm alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME} config={amConfig} />);

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
      setOnCallFeatures([]);
      setOnCallIntegrations([]);

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
        />
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
