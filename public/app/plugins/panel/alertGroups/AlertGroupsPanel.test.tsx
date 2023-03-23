import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { byTestId } from 'testing-library-selector';

import { getDefaultTimeRange, LoadingState, PanelProps, FieldConfigSource } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { fetchAlertGroups } from 'app/features/alerting/unified/api/alertmanager';
import {
  mockAlertGroup,
  mockAlertmanagerAlert,
  mockDataSource,
  MockDataSourceSrv,
} from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { configureStore } from 'app/store/configureStore';

import { AlertGroupsPanel } from './AlertGroupsPanel';
import { Options } from './panelcfg.gen';

jest.mock('app/features/alerting/unified/api/alertmanager');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {},
    panels: {},
    unifiedAlertingEnabled: true,
  },
}));

const mocks = {
  api: {
    fetchAlertGroups: jest.mocked(fetchAlertGroups),
  },
};

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

const defaultOptions: Options = {
  labels: '',
  alertmanager: 'Alertmanager',
  expandAll: false,
};

const defaultProps: PanelProps<Options> = {
  data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
  id: 1,
  timeRange: getDefaultTimeRange(),
  timeZone: 'utc',
  options: defaultOptions,
  eventBus: {
    subscribe: jest.fn(),
    getStream: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
    }),
    publish: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  },
  fieldConfig: {} as unknown as FieldConfigSource,
  height: 400,
  onChangeTimeRange: jest.fn(),
  onFieldConfigChange: jest.fn(),
  onOptionsChange: jest.fn(),
  renderCounter: 1,
  replaceVariables: jest.fn(),
  title: 'Alert groups test',
  transparent: false,
  width: 320,
};

const renderPanel = (options: Options = defaultOptions) => {
  const store = configureStore();
  const dash = new DashboardModel({ id: 1 } as Dashboard);
  dash.formatDate = (time: number) => new Date(time).toISOString();
  const dashSrv = { getCurrent: () => dash } as DashboardSrv;
  setDashboardSrv(dashSrv);

  defaultProps.options = options;
  const props = { ...defaultProps };

  return render(
    <Provider store={store}>
      <AlertGroupsPanel {...props} />
    </Provider>
  );
};

const ui = {
  group: byTestId('alert-group'),
  alert: byTestId('alert-group-alert'),
};

describe('AlertGroupsPanel', () => {
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

  it('renders the panel with the groups', async () => {
    renderPanel();

    const groups = await ui.group.findAll();

    expect(groups).toHaveLength(2);

    expect(groups[0]).toHaveTextContent('No grouping');
    expect(groups[1]).toHaveTextContent('severity=warningregion=US-Central');

    const alerts = ui.alert.queryAll();
    expect(alerts).toHaveLength(0);
  });

  it('renders panel with groups expanded', async () => {
    renderPanel({ labels: '', alertmanager: 'Alertmanager', expandAll: true });

    const alerts = await ui.alert.findAll();
    expect(alerts).toHaveLength(3);
  });

  it('filters alerts by label filter', async () => {
    renderPanel({ labels: 'region=US-Central', alertmanager: 'Alertmanager', expandAll: true });

    const alerts = await ui.alert.findAll();
    expect(alerts).toHaveLength(2);
  });
});
