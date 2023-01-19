import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { getDefaultTimeRange, LoadingState, PanelProps, FieldConfigSource } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { configureStore } from 'app/store/configureStore';

import { UnifiedAlertList } from './UnifiedAlertList';
import { UnifiedAlertListOptions, SortOrder, GroupMode, ViewMode } from './types';

jest.mock('app/features/alerting/unified/api/alertmanager');

const defaultOptions: UnifiedAlertListOptions = {
  maxItems: 2,
  sortOrder: SortOrder.AlphaAsc,
  dashboardAlerts: true,
  groupMode: GroupMode.Default,
  groupBy: [''],
  alertName: 'test',
  showInstances: false,
  folder: { id: 1, title: 'test folder' },
  stateFilter: { firing: true, pending: false, noData: false, normal: true, error: false },
  alertInstanceLabelFilter: '',
  datasource: 'Alertmanager',
  viewMode: ViewMode.List,
};

const defaultProps: PanelProps<UnifiedAlertListOptions> = {
  data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
  id: 1,
  timeRange: getDefaultTimeRange(),
  timeZone: 'utc',
  options: defaultOptions,
  eventBus: {
    subscribe: jest.fn(),
    getStream: jest.fn(),
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

const dashboard = {
  id: 1,
  formatDate: (time: number) => new Date(time).toISOString(),
  events: {
    subscribe: jest.fn(),
  },
};

const renderPanel = (options: UnifiedAlertListOptions = defaultOptions) => {
  const store = configureStore();

  const dashSrv: unknown = { getCurrent: () => dashboard };
  setDashboardSrv(dashSrv as DashboardSrv);

  defaultProps.options = options;
  const props = { ...defaultProps };

  return render(
    <Provider store={store}>
      <UnifiedAlertList {...props} />
    </Provider>
  );
};

describe('UnifiedAlertList', () => {
  it('subscribes to the dashboard refresh interval', async () => {
    await renderPanel();
    expect(dashboard.events.subscribe).toHaveBeenCalledTimes(1);
    expect(dashboard.events.subscribe.mock.calls[0][0]).toEqual(TimeRangeUpdatedEvent);
  });
});
