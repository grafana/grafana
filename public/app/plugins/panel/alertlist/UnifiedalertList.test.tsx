import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { byRole, byText } from 'testing-library-selector';

import { FieldConfigSource, getDefaultTimeRange, LoadingState, PanelProps, PluginExtensionTypes } from '@grafana/data';
import { TimeRangeUpdatedEvent, usePluginLinks } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { mockPromRulesApiResponse } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { mockRulerRulesApiResponse } from 'app/features/alerting/unified/mocks/rulerApi';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PromRuleGroupDTO, PromRulesResponse, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { contextSrv } from '../../../core/services/context_srv';
import {
  mockPromAlert,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  mockRulerGrafanaRule,
  mockUnifiedAlertingStore,
} from '../../../features/alerting/unified/mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../features/alerting/unified/utils/datasource';

import { UnifiedAlertListPanel } from './UnifiedAlertList';
import { GroupMode, SortOrder, UnifiedAlertListOptions, ViewMode } from './types';
import * as utils from './util';

const grafanaRuleMock = {
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
                  totals: { alerting: 1 },
                  totalsFiltered: { alerting: 1 },
                }),
              ],
            }),
          ],
        }),
      ],
    },
  },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));
jest.mock('app/features/alerting/unified/api/alertmanager');

const mocks = {
  usePluginLinksMock: jest.mocked(usePluginLinks),
};

const fakeResponse: PromRulesResponse = {
  data: { groups: grafanaRuleMock.promRules.grafana.result[0].groups as PromRuleGroupDTO[] },
  status: 'success',
};

const server = setupMswServer();

beforeEach(() => {
  mockPromRulesApiResponse(server, fakeResponse);
  const originRule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
    {
      for: '1m',
      labels: { severity: 'critical', region: 'nasa' },
      annotations: { [Annotation.summary]: 'This is a very important alert rule' },
    },
    { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] }
  );
  mockRulerRulesApiResponse(server, 'grafana', {
    'folder-one': [{ name: 'group1', interval: '20s', rules: [originRule] }],
  });
  mocks.usePluginLinksMock.mockReturnValue({
    links: [
      {
        pluginId: 'grafana-ml-app',
        id: '1',
        type: PluginExtensionTypes.link,
        title: 'Run investigation',
        category: 'Sift',
        description: 'Run a Sift investigation for this alert',
        onClick: jest.fn(),
      },
    ],
    isLoading: false,
  });
});

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
  datasource: 'grafana',
  viewMode: ViewMode.List,
  showInactiveAlerts: false,
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
  const store = mockUnifiedAlertingStore(grafanaRuleMock);

  const dashSrv: unknown = { getCurrent: () => dashboard };
  setDashboardSrv(dashSrv as DashboardSrv);

  const props = { ...defaultProps, options: { ...defaultOptions, ...options } };

  return render(
    <Provider store={store}>
      <UnifiedAlertListPanel {...props} />
    </Provider>
  );
};

describe('UnifiedAlertList', () => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

  it('subscribes to the dashboard refresh interval', async () => {
    jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('severity=critical');

    renderPanel();

    await waitFor(() => expect(dashboard.events.subscribe).toHaveBeenCalledTimes(1));
    expect(dashboard.events.subscribe.mock.calls[0][0]).toEqual(TimeRangeUpdatedEvent);
  });

  it('should replace option variables before filtering', async () => {
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
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

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(byText('rule1').get()).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('1 instance')).toBeInTheDocument();
    });

    const expandElement = byText('1 instance').get();

    await user.click(expandElement);

    const labelsElement = await byRole('list', { name: 'Labels' }).find();
    expect(await byRole('listitem').find(labelsElement)).toHaveTextContent('severitycritical');

    expect(replaceVarsSpy).toHaveBeenLastCalledWith('$label');
    expect(filterAlertsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        alertInstanceLabelFilter: 'severity=critical',
      }),
      expect.anything()
    );
  });

  it('should render authorization error when user has no permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    renderPanel();

    expect(screen.getByRole('alert', { name: 'Permission required' })).toBeInTheDocument();
  });
});
