import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AutoSizerProps } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byTestId } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, ContactPointsState, NotifierDTO, NotifierType } from 'app/types';

import { backendSrv } from '../../../../../core/services/backend_srv';
import * as receiversApi from '../../api/receiversApi';
import { mockProvisioningApi, setupMswServer } from '../../mockApi';
import { enableRBAC, grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { fetchGrafanaNotifiersAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { ReceiversTable } from './ReceiversTable';
import * as receiversMeta from './grafanaAppReceivers/useReceiversMetadata';
import { ReceiverMetadata } from './grafanaAppReceivers/useReceiversMetadata';

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) => children({ height: 600, width: 1 });
});
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: { value: string }) => <textarea data-testid="code-editor" value={value} readOnly />,
}));

const renderReceieversTable = async (
  receivers: Receiver[],
  notifiers: NotifierDTO[],
  alertmanagerName = 'alertmanager-1'
) => {
  const config: AlertManagerCortexConfig = {
    template_files: {},
    alertmanager_config: {
      receivers,
    },
  };

  const store = configureStore();
  await store.dispatch(fetchGrafanaNotifiersAction.fulfilled(notifiers, 'initial'));

  return render(
    <TestProvider store={store}>
      <AlertmanagerProvider accessType={'notification'}>
        <ReceiversTable config={config} alertManagerName={alertmanagerName} />
      </AlertmanagerProvider>
    </TestProvider>
  );
};

const mockGrafanaReceiver = (type: string): GrafanaManagedReceiverConfig => ({
  type,
  disableResolveMessage: false,
  secureFields: {},
  settings: {},
  name: type,
});

const mockNotifier = (type: NotifierType, name: string): NotifierDTO => ({
  type,
  name,
  description: 'its a mock',
  heading: 'foo',
  options: [],
});

const useReceiversMetadata = jest.spyOn(receiversMeta, 'useReceiversMetadata');
const useGetContactPointsStateMock = jest.spyOn(receiversApi, 'useGetContactPointsState');

setBackendSrv(backendSrv);

const server = setupMswServer();

afterEach(() => {
  server.resetHandlers();
});

const ui = {
  export: {
    dialog: byRole('dialog', { name: 'Drawer title Export' }),
    jsonTab: byRole('tab', { name: /JSON/ }),
    yamlTab: byRole('tab', { name: /YAML/ }),
    editor: byTestId('code-editor'),
    copyCodeButton: byRole('button', { name: 'Copy code' }),
    downloadButton: byRole('button', { name: 'Download' }),
  },
};

describe('ReceiversTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const emptyContactPointsState: ContactPointsState = { receivers: {}, errorCount: 0 };
    useGetContactPointsStateMock.mockReturnValue(emptyContactPointsState);
    useReceiversMetadata.mockReturnValue(new Map<Receiver, ReceiverMetadata>());
  });

  it('render receivers with grafana notifiers', async () => {
    const receivers: Receiver[] = [
      {
        name: 'with receivers',
        grafana_managed_receiver_configs: [mockGrafanaReceiver('googlechat'), mockGrafanaReceiver('sensugo')],
      },
      {
        name: 'without receivers',
        grafana_managed_receiver_configs: [],
      },
    ];

    const notifiers: NotifierDTO[] = [mockNotifier('googlechat', 'Google Chat'), mockNotifier('sensugo', 'Sensu Go')];

    await renderReceieversTable(receivers, notifiers);

    const rows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('with receivers');
    expect(rows[0].querySelector('[data-column="Type"]')).toHaveTextContent('Google Chat, Sensu Go');
    expect(rows[1]).toHaveTextContent('without receivers');
    expect(rows[1].querySelector('[data-column="Type"]')).toHaveTextContent('');
  });

  it('render receivers with alertmanager notifers', async () => {
    const receivers: Receiver[] = [
      {
        name: 'with receivers',
        email_configs: [
          {
            to: 'domas.lapinskas@grafana.com',
          },
        ],
        slack_configs: [],
        webhook_configs: [
          {
            url: 'http://example.com',
          },
        ],
        opsgenie_configs: [
          {
            foo: 'bar',
          },
        ],
        foo_configs: [
          {
            url: 'bar',
          },
        ],
      },
      {
        name: 'without receivers',
      },
    ];

    await renderReceieversTable(receivers, []);

    const rows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('with receivers');
    expect(rows[0].querySelector('[data-column="Type"]')).toHaveTextContent('Email, Webhook, OpsGenie, Foo');
    expect(rows[1]).toHaveTextContent('without receivers');
    expect(rows[1].querySelector('[data-column="Type"]')).toHaveTextContent('');
  });

  describe('RBAC Enabled', () => {
    describe('Export button', () => {
      const receivers: Receiver[] = [
        {
          name: 'with receivers',
          grafana_managed_receiver_configs: [mockGrafanaReceiver('googlechat'), mockGrafanaReceiver('sensugo')],
        },
        {
          name: 'no receivers',
        },
      ];

      const notifiers: NotifierDTO[] = [mockNotifier('googlechat', 'Google Chat'), mockNotifier('sensugo', 'Sensu Go')];

      it('should be visible when user has permissions to read provisioning', async () => {
        enableRBAC();
        grantUserPermissions([AccessControlAction.AlertingProvisioningRead]);

        await renderReceieversTable(receivers, notifiers, GRAFANA_RULES_SOURCE_NAME);

        const buttons = within(screen.getByTestId('dynamic-table')).getAllByTestId('export');
        expect(buttons).toHaveLength(2);
      });
      it('should be visible when user has permissions to read provisioning with secrets', async () => {
        enableRBAC();
        grantUserPermissions([AccessControlAction.AlertingProvisioningReadSecrets]);

        await renderReceieversTable(receivers, notifiers, GRAFANA_RULES_SOURCE_NAME);

        const buttons = within(screen.getByTestId('dynamic-table')).getAllByTestId('export');
        expect(buttons).toHaveLength(2);
      });
      it('should not be visible when user has no provisioning permissions', async () => {
        enableRBAC();
        grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

        await renderReceieversTable(receivers, [], GRAFANA_RULES_SOURCE_NAME);

        const buttons = within(screen.getByTestId('dynamic-table')).queryAllByTestId('export');
        expect(buttons).toHaveLength(0);
      });
    });
  });

  describe('Exporter functionality', () => {
    it('Should allow exporting receiver', async () => {
      // Arrange
      mockProvisioningApi(server).exportReceiver('coolReceiver', 'true', {
        yaml: 'Yaml Export Content',
        json: 'Json Export Content',
      });

      const user = userEvent.setup();

      const receivers: Receiver[] = [
        {
          name: 'with receivers',
          grafana_managed_receiver_configs: [mockGrafanaReceiver('googlechat'), mockGrafanaReceiver('sensugo')],
        },
        {
          name: 'no receivers',
        },
      ];

      const notifiers: NotifierDTO[] = [mockNotifier('googlechat', 'Google Chat'), mockNotifier('sensugo', 'Sensu Go')];

      enableRBAC();
      grantUserPermissions([AccessControlAction.AlertingProvisioningRead]);

      // Act
      await renderReceieversTable(receivers, notifiers, GRAFANA_RULES_SOURCE_NAME);

      const buttons = within(screen.getByTestId('dynamic-table')).getAllByTestId('export');
      // click first export button
      await user.click(buttons[0]);
      const drawer = await ui.export.dialog.find();

      // Assert
      expect(ui.export.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => {
        expect(ui.export.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
      });
      await user.click(ui.export.jsonTab.get(drawer));
      await waitFor(() => {
        expect(ui.export.editor.get(drawer)).toHaveTextContent('Json Export Content');
      });
      expect(ui.export.copyCodeButton.get(drawer)).toBeInTheDocument();
      expect(ui.export.downloadButton.get(drawer)).toBeInTheDocument();
    });
  });
});
