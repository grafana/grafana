import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { fetchAlertGroups } from './api/alertmanager';
import { byRole, byTestId, byText } from 'testing-library-selector';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import AlertGroups from './AlertGroups';
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
        <AlertGroups />
      </Router>
    </Provider>
  );
};

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  group: byTestId('alert-group'),
  groupCollapseToggle: byTestId('alert-group-collapse-toggle'),
  groupTable: byTestId('alert-group-table'),
  row: byTestId('row'),
  collapseToggle: byTestId('collapse-toggle'),
  silenceButton: byText('Silence'),
  sourceButton: byText('See source'),
  matcherInput: byTestId('search-query-input'),
  groupByContainer: byTestId('group-by-container'),
  groupByInput: byRole('combobox', { name: /group by label keys/i }),
  clearButton: byRole('button', { name: 'Clear filters' }),
};

describe('AlertGroups', () => {
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
    renderAmNotifications();

    await waitFor(() => expect(mocks.api.fetchAlertGroups).toHaveBeenCalled());

    const groups = ui.group.getAll();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('No grouping');
    expect(groups[1]).toHaveTextContent('severity=warningregion=US-Central');

    userEvent.click(ui.groupCollapseToggle.get(groups[0]));
    expect(ui.groupTable.get()).toBeDefined();

    userEvent.click(ui.collapseToggle.get(ui.groupTable.get()));
    expect(ui.silenceButton.get(ui.groupTable.get())).toBeDefined();
    expect(ui.sourceButton.get(ui.groupTable.get())).toBeDefined();
  });

  it('should group by custom grouping', async () => {
    const regions = ['NASA', 'EMEA', 'APAC'];
    mocks.api.fetchAlertGroups.mockImplementation(() => {
      const groups = regions.map((region) =>
        mockAlertGroup({
          labels: { region },
          alerts: [
            mockAlertmanagerAlert({ labels: { region, appName: 'billing', env: 'production' } }),
            mockAlertmanagerAlert({ labels: { region, appName: 'auth', env: 'staging', uniqueLabel: 'true' } }),
            mockAlertmanagerAlert({ labels: { region, appName: 'frontend', env: 'production' } }),
          ],
        })
      );
      return Promise.resolve(groups);
    });

    renderAmNotifications();
    await waitFor(() => expect(mocks.api.fetchAlertGroups).toHaveBeenCalled());
    let groups = ui.group.getAll();
    const groupByInput = ui.groupByInput.get();
    const groupByWrapper = ui.groupByContainer.get();

    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('region=NASA');
    expect(groups[1]).toHaveTextContent('region=EMEA');
    expect(groups[2]).toHaveTextContent('region=APAC');

    userEvent.type(groupByInput, 'appName{enter}');

    await waitFor(() => expect(groupByWrapper).toHaveTextContent('appName'));

    groups = ui.group.getAll();

    await waitFor(() => expect(ui.clearButton.get()).toBeInTheDocument());
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('appName=billing');
    expect(groups[1]).toHaveTextContent('appName=auth');
    expect(groups[2]).toHaveTextContent('appName=frontend');

    userEvent.click(ui.clearButton.get());
    await waitFor(() => expect(groupByWrapper).not.toHaveTextContent('appName'));

    userEvent.type(groupByInput, 'env{enter}');
    await waitFor(() => expect(groupByWrapper).toHaveTextContent('env'));

    groups = ui.group.getAll();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('env=production');
    expect(groups[1]).toHaveTextContent('env=staging');

    userEvent.click(ui.clearButton.get());
    await waitFor(() => expect(groupByWrapper).not.toHaveTextContent('env'));

    userEvent.type(groupByInput, 'uniqueLabel{enter}');
    await waitFor(() => expect(groupByWrapper).toHaveTextContent('uniqueLabel'));

    groups = ui.group.getAll();
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('No grouping');
    expect(groups[1]).toHaveTextContent('uniqueLabel=true');
  });
});
