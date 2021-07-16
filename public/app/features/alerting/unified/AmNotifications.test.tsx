import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { fetchAlertGroups } from './api/alertmanager';
import { byTestId, byText } from 'testing-library-selector';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import AmNotifications from './AmNotifications';
import { mockAlertGroup, mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv } from './mocks';
import { DataSourceType } from './utils/datasource';
import userEvent from '@testing-library/user-event';

jest.mock('./api/alertmanager');

const mocks = {
  api: {
    fetchAlertGroups: typeAsJestMock(fetchAlertGroups),
  },
};

const renderAmNotifications = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <AmNotifications />
      </Router>
    </Provider>
  );
};

const dataSources = {
  am: mockDataSource({
    name: 'Alert Manager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  group: byTestId('notifications-group'),
  groupCollapseToggle: byTestId('notifications-group-collapse-toggle'),
  notificationsTable: byTestId('notifications-table'),
  row: byTestId('row'),
  collapseToggle: byTestId('collapse-toggle'),
  silenceButton: byText('Silence'),
  sourceButton: byText('See source'),
};

describe('AmNotifications', () => {
  beforeAll(() => {
    mocks.api.fetchAlertGroups.mockImplementation(() => {
      return Promise.resolve([
        mockAlertGroup({ labels: {}, alerts: [mockAlertmanagerAlert({ labels: { foo: 'bar' } })] }),
        mockAlertGroup(),
      ]);
    });
  });

  beforeEach(() => {
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
  });

  it('loads and shows groups', async () => {
    await renderAmNotifications();

    await waitFor(() => expect(mocks.api.fetchAlertGroups).toHaveBeenCalled());

    const groups = await ui.group.getAll();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('No grouping');
    expect(groups[1]).toHaveTextContent('severity=warningregion=US-Central');

    userEvent.click(ui.groupCollapseToggle.get(groups[0]));
    expect(ui.notificationsTable.get()).toBeDefined();

    userEvent.click(ui.collapseToggle.get(ui.notificationsTable.get()));
    expect(ui.silenceButton.get(ui.notificationsTable.get())).toBeDefined();
    expect(ui.sourceButton.get(ui.notificationsTable.get())).toBeDefined();
  });
});
