import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byTestId } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import {
  AlertManagerCortexConfig,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import {
  fetchAlertManagerConfig,
  deleteAlertManagerConfig,
  updateAlertManagerConfig,
  fetchStatus,
} from '../../api/alertmanager';
import {
  grantUserPermissions,
  mockDataSource,
  someCloudAlertManagerConfig,
  someCloudAlertManagerStatus,
} from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { getAllDataSources } from '../../utils/config';
import { DataSourceType } from '../../utils/datasource';

import AlertmanagerConfig from './AlertmanagerConfig';

jest.mock('../../api/alertmanager');
jest.mock('../../api/grafana');
jest.mock('../../utils/config');

const mocks = {
  getAllDataSources: jest.mocked(getAllDataSources),

  api: {
    fetchConfig: jest.mocked(fetchAlertManagerConfig),
    deleteAlertManagerConfig: jest.mocked(deleteAlertManagerConfig),
    updateAlertManagerConfig: jest.mocked(updateAlertManagerConfig),
    fetchStatus: jest.mocked(fetchStatus),
  },
};

const renderConfigurationDrawer = (
  alertManagerSourceName: string,
  { onDismiss = jest.fn(), onSave = jest.fn(), onReset = jest.fn() }
) => {
  return render(
    <TestProvider>
      <AlertmanagerProvider accessType="instance">
        <AlertmanagerConfig
          alertmanagerName={alertManagerSourceName}
          onDismiss={onDismiss}
          onSave={onSave}
          onReset={onReset}
        />
      </AlertmanagerProvider>
    </TestProvider>
  );
};

const dataSources = {
  alertManager: mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
  }),
  promAlertManager: mockDataSource<AlertManagerDataSourceJsonData>({
    name: 'PromManager',
    type: DataSourceType.Alertmanager,
    jsonData: {
      implementation: AlertManagerImplementation.prometheus,
    },
  }),
};

const ui = {
  confirmButton: byRole('button', { name: /Yes, reset configuration/ }),
  resetButton: byRole('button', { name: /Reset/ }),
  saveButton: byRole('button', { name: /Save/ }),
  configInput: byTestId(selectors.components.CodeEditor.container),
  readOnlyConfig: byTestId('readonly-config'),
};

describe.skip('Alerting Settings', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingInstanceRead]);
  });

  describe('Built-in Alertmanager', () => {});

  describe('Vanilla Alertmanager', () => {});

  describe('Mimir Alertmanager', () => {});

  it('Reset alertmanager config', async () => {
    mocks.api.fetchConfig.mockResolvedValue({
      template_files: {
        foo: 'bar',
      },
      alertmanager_config: {},
    });

    const onReset = jest.fn();
    renderConfigurationDrawer(dataSources.alertManager.name, { onReset });

    await userEvent.click(await ui.resetButton.find());
    await userEvent.click(ui.confirmButton.get());

    await waitFor(() => expect(onReset).toHaveBeenCalled());
    expect(onReset.mock.lastCall).toMatchSnapshot();
    await waitFor(() => {
      expect(ui.confirmButton.get()).toBeInTheDocument();
    });
  });

  it('Editable alertmanager config', async () => {
    let savedConfig: AlertManagerCortexConfig | undefined = undefined;

    const defaultConfig = {
      template_files: {},
      alertmanager_config: {
        route: {
          receiver: 'old one',
        },
      },
    };

    mocks.api.fetchConfig.mockImplementation(() => Promise.resolve(savedConfig ?? defaultConfig));
    mocks.api.updateAlertManagerConfig.mockResolvedValue();

    const onSave = jest.fn();
    renderConfigurationDrawer(dataSources.alertManager.name, { onSave });

    await ui.configInput.find();
    await userEvent.click(ui.saveButton.get());

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mocks.api.updateAlertManagerConfig.mock.lastCall).toMatchSnapshot();

    await waitFor(() => expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(2));
  });

  it('Read-only when using Prometheus Alertmanager', async () => {
    mocks.api.fetchStatus.mockResolvedValue({
      ...someCloudAlertManagerStatus,
      config: someCloudAlertManagerConfig.alertmanager_config,
    });
    renderConfigurationDrawer(dataSources.promAlertManager.name, {});

    await ui.readOnlyConfig.find();
    expect(ui.resetButton.query()).not.toBeInTheDocument();
    expect(ui.saveButton.query()).not.toBeInTheDocument();

    expect(mocks.api.fetchConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
  });
});
