import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { byRole, byText } from 'testing-library-selector';

import { getDefaultTimeRange, LoadingState, PanelProps, FieldConfigSource } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { contextSrv } from '../../../core/services/context_srv';
import {
  mockPromAlert,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  mockUnifiedAlertingStore,
} from '../../../features/alerting/unified/mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../features/alerting/unified/utils/datasource';

import { UnifiedAlertList } from './UnifiedAlertList';
import { UnifiedAlertListOptions, SortOrder, GroupMode, ViewMode } from './types';
import * as utils from './util';

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

const renderPanel = (options: Partial<UnifiedAlertListOptions> = defaultOptions) => {
  const store = mockUnifiedAlertingStore({
    promRules: {
      grafana: {
        loading: false,
        dispatched: true,
        result: [
          mockPromRuleNamespace({
            name: 'ns1',
            groups: [
              mockPromRuleGroup({
                name: 'group1',
                rules: [
                  mockPromAlertingRule({
                    name: 'rule1',
                    alerts: [mockPromAlert({ labels: { severity: 'critical' } })],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    },
  });

  const dashSrv: unknown = { getCurrent: () => dashboard };
  setDashboardSrv(dashSrv as DashboardSrv);

  const props = { ...defaultProps, options: { ...defaultOptions, ...options } };

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

  it('should replace option variables before filtering', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    const filterAlertsSpy = jest.spyOn(utils, 'filterAlerts');

    const replaceVarsSpy = jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('severity=critical');

    const user = userEvent.setup();

    renderPanel({
      alertInstanceLabelFilter: '$label',
      dashboardAlerts: false,
      alertName: '',
      datasource: GRAFANA_RULES_SOURCE_NAME,
      folder: undefined,
    });

    expect(byText('rule1').get()).toBeInTheDocument();

    const expandElement = byText('1 instance').get();

    await user.click(expandElement);

    const tagsElement = await byRole('list', { name: 'Tags' }).find();
    expect(await byRole('listitem').find(tagsElement)).toHaveTextContent('severity=critical');

    expect(replaceVarsSpy).toHaveBeenLastCalledWith('$label');
    expect(filterAlertsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        alertInstanceLabelFilter: 'severity=critical',
      }),
      expect.anything()
    );
  });
});
