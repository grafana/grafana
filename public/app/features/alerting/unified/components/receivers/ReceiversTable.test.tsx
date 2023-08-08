import { screen, render, within } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, ContactPointsState, NotifierDTO, NotifierType } from 'app/types';

import * as onCallApi from '../../api/onCallApi';
import * as receiversApi from '../../api/receiversApi';
import { enableRBAC, grantUserPermissions } from '../../mocks';
import { fetchGrafanaNotifiersAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { createUrl } from '../../utils/url';

import { ReceiversTable } from './ReceiversTable';
import * as grafanaApp from './grafanaAppReceivers/grafanaApp';

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
      <ReceiversTable config={config} alertManagerName={alertmanagerName} />
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

jest.spyOn(onCallApi, 'useGetOnCallIntegrationsQuery');
const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');
const useGetContactPointsStateMock = jest.spyOn(receiversApi, 'useGetContactPointsState');

describe('ReceiversTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const emptyContactPointsState: ContactPointsState = { receivers: {}, errorCount: 0 };
    useGetContactPointsStateMock.mockReturnValue(emptyContactPointsState);
    useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);
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
        expect(buttons).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              href: createUrl(`http://localhost/api/v1/provisioning/contact-points/export/`, {
                download: 'true',
                format: 'yaml',
                decrypt: 'false',
                name: 'with receivers',
              }),
            }),
            expect.objectContaining({
              href: createUrl(`http://localhost/api/v1/provisioning/contact-points/export/`, {
                download: 'true',
                format: 'yaml',
                decrypt: 'false',
                name: 'no receivers',
              }),
            }),
          ])
        );
      });
      it('should be visible when user has permissions to read provisioning with secrets', async () => {
        enableRBAC();
        grantUserPermissions([AccessControlAction.AlertingProvisioningReadSecrets]);

        await renderReceieversTable(receivers, notifiers, GRAFANA_RULES_SOURCE_NAME);

        const buttons = within(screen.getByTestId('dynamic-table')).getAllByTestId('export');
        expect(buttons).toHaveLength(2);
        expect(buttons).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              href: createUrl(`http://localhost/api/v1/provisioning/contact-points/export/`, {
                download: 'true',
                format: 'yaml',
                decrypt: 'true',
                name: 'with receivers',
              }),
            }),
            expect.objectContaining({
              href: createUrl(`http://localhost/api/v1/provisioning/contact-points/export/`, {
                download: 'true',
                format: 'yaml',
                decrypt: 'true',
                name: 'no receivers',
              }),
            }),
          ])
        );
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
});
