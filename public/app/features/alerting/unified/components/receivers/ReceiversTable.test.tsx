import React from 'react';
import { render } from '@testing-library/react';
import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { ReceiversTable } from './ReceiversTable';
import { fetchGrafanaNotifiersAction } from '../../state/actions';
import { NotifierDTO, NotifierType } from 'app/types';
import { byRole } from 'testing-library-selector';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';

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
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <ReceiversTable config={config} alertManagerName="alertmanager-1" />
      </Router>
    </Provider>
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

const ui = {
  table: byRole<HTMLTableElement>('table'),
};

describe('ReceiversTable', () => {
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

    const table = await ui.table.find();

    const rows = table.querySelector('tbody')?.querySelectorAll('tr')!;
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll('td')[0]).toHaveTextContent('with receivers');
    expect(rows[0].querySelectorAll('td')[1]).toHaveTextContent('Google Chat, Sensu Go');
    expect(rows[1].querySelectorAll('td')[0]).toHaveTextContent('without receivers');
    expect(rows[1].querySelectorAll('td')[1].textContent).toEqual('');
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

    const table = await ui.table.find();

    const rows = table.querySelector('tbody')?.querySelectorAll('tr')!;
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll('td')[0]).toHaveTextContent('with receivers');
    expect(rows[0].querySelectorAll('td')[1]).toHaveTextContent('Email, Webhook, OpsGenie, Foo');
    expect(rows[1].querySelectorAll('td')[0]).toHaveTextContent('without receivers');
    expect(rows[1].querySelectorAll('td')[1].textContent).toEqual('');
  });
});
