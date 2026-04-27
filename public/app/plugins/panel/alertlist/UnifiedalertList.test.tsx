import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import {
  type FieldConfigSource,
  getDefaultTimeRange,
  LoadingState,
  type PanelProps,
  PluginExtensionTypes,
  ThresholdsMode,
} from '@grafana/data/types';
import { config, TimeRangeUpdatedEvent, usePluginLinks } from '@grafana/runtime';
import { BigValueColorMode } from '@grafana/ui';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { mockPromRulesApiResponse } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { mockRulerRulesApiResponse } from 'app/features/alerting/unified/mocks/rulerApi';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { type DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import {
  type PromRuleGroupDTO,
  type PromRulesResponse,
  type RulerGrafanaRuleDTO,
} from 'app/types/unified-alerting-dto';

import { contextSrv } from '../../../core/services/context_srv';
import {
  grantUserPermissions,
  mockPromAlert,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  mockRulerGrafanaRule,
  mockUnifiedAlertingStore,
} from '../../../features/alerting/unified/mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../features/alerting/unified/utils/datasource';
import { AccessControlAction } from '../../../types/accessControl';

import { UnifiedAlertListPanel } from './UnifiedAlertList';
import { GroupMode, SortOrder, STAT_THRESHOLDS_DEFAULT, type UnifiedAlertListOptions, ViewMode } from './types';
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
  folder: { uid: 'abc', title: 'test folder' },
  stateFilter: { firing: true, pending: false, noData: false, normal: true, error: false, recovering: false },
  alertInstanceLabelFilter: '',
  datasource: 'grafana',
  viewMode: ViewMode.List,
  showInactiveAlerts: false,
  statColorMode: BigValueColorMode.None,
  statThresholds: STAT_THRESHOLDS_DEFAULT,
  statValueMappings: [],
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

  return render(<UnifiedAlertListPanel {...props} />, { store });
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

  it('should re-subscribe to dashboard refresh after useEffect dependencies change', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);

    const unsubscribeMock = jest.fn();
    const subscribeMock = jest.fn().mockReturnValue({ unsubscribe: unsubscribeMock });
    const dashboardMock = {
      id: 1,
      formatDate: (time: number) => new Date(time).toISOString(),
      events: { subscribe: subscribeMock },
    };

    const dashSrv: unknown = { getCurrent: () => dashboardMock };
    setDashboardSrv(dashSrv as DashboardSrv);

    jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('');

    const store = mockUnifiedAlertingStore(grafanaRuleMock);

    const initialOptions: UnifiedAlertListOptions = {
      ...defaultOptions,
      dashboardAlerts: false,
      alertName: '',
      stateFilter: { firing: true, pending: false, noData: false, normal: true, error: false, recovering: false },
    };

    const { rerender } = render(<UnifiedAlertListPanel {...{ ...defaultProps, options: initialOptions }} />, { store });

    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1));
    expect(subscribeMock.mock.calls[0][0]).toEqual(TimeRangeUpdatedEvent);

    const updatedOptions: UnifiedAlertListOptions = {
      ...initialOptions,
      stateFilter: { firing: true, pending: true, noData: true, normal: true, error: true, recovering: true },
    };

    rerender(<UnifiedAlertListPanel {...{ ...defaultProps, options: updatedOptions }} />);

    // The old subscription should be cleaned up
    await waitFor(() => expect(unsubscribeMock).toHaveBeenCalled());

    // The subscription should be re-created after the useEffect re-runs.
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(2));
    expect(subscribeMock.mock.calls[1][0]).toEqual(TimeRangeUpdatedEvent);
  });

  describe('stat mode with feature flag off', () => {
    beforeEach(() => {
      config.featureToggles.alertingAlertListPanelEnhancements = false;
      jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('');
    });

    it('renders plain stat value without link when flag is off', async () => {
      renderPanel({
        viewMode: ViewMode.Stat,
        dashboardAlerts: false,
        alertName: '',
        datasource: GRAFANA_RULES_SOURCE_NAME,
        folder: undefined,
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('stat mode with feature flag on', () => {
    beforeEach(() => {
      config.featureToggles.alertingAlertListPanelEnhancements = true;
      jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('');
    });

    afterEach(() => {
      config.featureToggles.alertingAlertListPanelEnhancements = false;
    });

    it('renders stat value wrapped in a link when flag is on', async () => {
      renderPanel({
        viewMode: ViewMode.Stat,
        dashboardAlerts: false,
        alertName: '',
        datasource: GRAFANA_RULES_SOURCE_NAME,
        folder: undefined,
        statColorMode: BigValueColorMode.None,
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', expect.stringContaining('/alerting/list'));
    });

    it('uses variable-expanded options when building the stat link', async () => {
      jest
        .spyOn(defaultProps, 'replaceVariables')
        .mockImplementation((value: string) => (value === '$alert' ? 'cpu-high' : ''));

      renderPanel({
        viewMode: ViewMode.Stat,
        dashboardAlerts: false,
        alertName: '$alert',
        datasource: GRAFANA_RULES_SOURCE_NAME,
        folder: undefined,
        statColorMode: BigValueColorMode.None,
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', expect.stringContaining('cpu-high'));
    });

    it('renders stat value with threshold color when colorMode is Value', async () => {
      renderPanel({
        viewMode: ViewMode.Stat,
        dashboardAlerts: false,
        alertName: '',
        datasource: GRAFANA_RULES_SOURCE_NAME,
        folder: undefined,
        statColorMode: BigValueColorMode.Value,
        statThresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 5, color: 'red' },
          ],
        },
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });
});
