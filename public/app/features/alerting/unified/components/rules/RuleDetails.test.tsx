import 'whatwg-fetch';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';

import { PluginExtensionTypes } from '@grafana/data';
import { getPluginLinkExtensions, setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { AlertmanagersChoiceResponse } from '../../api/alertmanagerApi';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { SupportedPlugin } from '../../types/pluginBridges';

import { RuleDetails } from './RuleDetails';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn(),
  useReturnToPrevious: jest.fn(),
}));

jest.mock('../../hooks/useIsRuleEditable');

const mocks = {
  getPluginLinkExtensionsMock: jest.mocked(getPluginLinkExtensions),
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: /edit/i }),
    delete: byRole('button', { name: /delete/i }),
    silence: byRole('link', { name: 'Silence' }),
  },
};

const server = setupServer(
  http.get(`/api/plugins/${SupportedPlugin.Incident}/settings`, async () => {
    return HttpResponse.json({
      enabled: false,
    });
  })
);

const alertmanagerChoiceMockedResponse: AlertmanagersChoiceResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
  jest.clearAllMocks();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  mocks.getPluginLinkExtensionsMock.mockReturnValue({
    extensions: [
      {
        pluginId: 'grafana-ml-app',
        id: '1',
        type: PluginExtensionTypes.link,
        title: 'Run investigation',
        category: 'Sift',
        description: 'Run a Sift investigation for this alert',
        onClick: jest.fn(),
      },
    ],
  });
  server.resetHandlers();
  mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
});

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
      await waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
    });

    it('Should not render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
      await waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
    });

    it('Should not render Silence button for users wihout the instance create permission', async () => {
      // Arrange
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.silence.query()).not.toBeInTheDocument();
      await waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
    });

    it('Should render Silence button for users with the instance create permissions', async () => {
      // Arrange
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingInstanceCreate);

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(await ui.actionButtons.silence.find()).toBeInTheDocument();
      await waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
    });
  });

  describe('Cloud rules action buttons', () => {
    const cloudRule = getCloudRule({ name: 'Cloud' });

    it('Should not render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
      await waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
    });

    it('Should not render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
      await waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
    });
  });
});

function renderRuleDetails(rule: CombinedRule) {
  const store = configureStore();

  render(
    <Provider store={store}>
      <MemoryRouter>
        <RuleDetails rule={rule} />
      </MemoryRouter>
    </Provider>
  );
}
