import { screen, render, within } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { ContactPointsState, NotifierDTO, NotifierType } from 'app/types';

import { backendSrv } from '../../../../../core/services/backend_srv';
import * as receiversApi from '../../api/receiversApi';
import { fetchGrafanaNotifiersAction } from '../../state/actions';

import { ReceiversTable } from './ReceiversTable';
import * as receiversMeta from './grafanaAppReceivers/useReceiversMetadata';
import { ReceiverMetadata } from './grafanaAppReceivers/useReceiversMetadata';

const renderReceieversTable = async (receivers: Receiver[], notifiers: NotifierDTO[]) => {
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
      <ReceiversTable config={config} alertManagerName="alertmanager-1" />
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
});
