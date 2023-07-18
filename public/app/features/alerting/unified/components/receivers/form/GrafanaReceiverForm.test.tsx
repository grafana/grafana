import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byLabelText, byTestId, byText } from 'testing-library-selector';

import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';

import { AlertmanagerConfigBuilder, mockApi, setupMswServer } from '../../../mockApi';
import { grafanaAlertNotifiersMock } from '../../../mockGrafanaNotifiers';
import { onCallPluginMetaMock } from '../../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import { GrafanaReceiverForm } from './GrafanaReceiverForm';

import 'core-js/stable/structured-clone';

const server = setupMswServer();

const ui = {
  loadingIndicator: byText('Loading notifiers...'),
  integrationType: byLabelText('Integration'),
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

      const amConfig = new AlertmanagerConfigBuilder().build();

      render(
        <GrafanaReceiverForm
          alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
          config={{
            alertmanager_config: amConfig,
            template_files: {},
          }}
        />,
        { wrapper: TestProvider }
      );

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');
      // Clicking on a disable element shouldn't change the form value. email is the default value
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'email' });

      await clickSelectOption(byTestId('items.0.type').get(), 'Alertmanager');
      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'prometheus-alertmanager' });
    });

    it('OnCall contact point should be enabled if OnCall integration is enabled', async () => {
      mockApi(server).grafanaNotifiers(grafanaAlertNotifiersMock);
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.getOnCallIntegrations([]);

      const amConfig = new AlertmanagerConfigBuilder().build();

      render(
        <GrafanaReceiverForm
          alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
          config={{
            alertmanager_config: amConfig,
            template_files: {},
          }}
        />,
        { wrapper: TestProvider }
      );

      await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

      await clickSelectOption(byTestId('items.0.type').get(), 'Grafana OnCall');

      expect(ui.integrationType.get().closest('form')).toHaveFormValues({ 'items.0.type': 'oncall' });
    });
  });
});
