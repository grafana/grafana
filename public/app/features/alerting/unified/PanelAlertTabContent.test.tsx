import { render } from 'test/test-utils';
import { byTestId, byText } from 'testing-library-selector';

import { PromOptions } from '@grafana/prometheus';
import { setPluginLinksHook } from '@grafana/runtime';
import config from 'app/core/config';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { AccessControlAction } from 'app/types';
import { AlertQuery, PromRulesResponse } from 'app/types/unified-alerting-dto';

import { PanelAlertTabContent } from './PanelAlertTabContent';
import * as apiRuler from './api/ruler';
import * as alertingAbilities from './hooks/useAbilities';
import { mockAlertRuleApi, setupMswServer } from './mockApi';
import {
  grantUserPermissions,
  mockDataSource,
  mockPromAlert,
  mockPromAlertingRule,
  mockRulerAlertingRule,
  mockRulerRuleGroup,
} from './mocks';
import { captureRequests } from './mocks/server/events';
import { RuleFormValues } from './types/rule-form';
import { Annotation } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

jest.mock('./api/ruler');
jest.spyOn(alertingAbilities, 'useAlertRuleAbility');

const prometheusModuleSettings = { alerting: true, module: 'core:plugin/prometheus' };

const dataSources = {
  prometheus: mockDataSource<PromOptions>(
    {
      name: 'Prometheus',
      type: DataSourceType.Prometheus,
      isDefault: false,
      jsonData: { manageAlerts: true },
    },
    prometheusModuleSettings
  ),
  default: mockDataSource<PromOptions>(
    {
      name: 'Default',
      type: DataSourceType.Prometheus,
      isDefault: true,
      jsonData: { manageAlerts: true },
    },
    prometheusModuleSettings
  ),
  prometheusMinInterval: mockDataSource<PromOptions>(
    {
      name: 'Prometheus Min Interval',
      type: DataSourceType.Prometheus,
      isDefault: false,
      jsonData: { manageAlerts: true, timeInterval: '7m' },
    },
    prometheusModuleSettings
  ),
};

const mocks = {
  useAlertRuleAbilityMock: jest.mocked(alertingAbilities.useAlertRuleAbility),
  rulerBuilderMock: jest.mocked(apiRuler.rulerUrlBuilder),
};

const renderAlertTabContent = (dashboard: DashboardModel, panel: PanelModel) =>
  render(<PanelAlertTabContent dashboard={dashboard} panel={panel} />);

const promResponse: PromRulesResponse = {
  status: 'success',
  data: {
    groups: [
      {
        name: 'mygroup',
        file: 'default',
        rules: [
          mockPromAlertingRule({
            name: 'dashboardrule1',
            alerts: [
              mockPromAlert({
                labels: { severity: 'critical' },
                annotations: {
                  [Annotation.dashboardUID]: '12',
                  [Annotation.panelID]: '34',
                },
              }),
            ],
            totals: { alerting: 1 },
            totalsFiltered: { alerting: 1 },
          }),
        ],
        interval: 20,
      },
      {
        name: 'othergroup',
        file: 'default',
        rules: [
          mockPromAlertingRule({
            name: 'dashboardrule2',
            alerts: [
              mockPromAlert({
                labels: { severity: 'critical' },
                annotations: {
                  [Annotation.dashboardUID]: '121',
                  [Annotation.panelID]: '341',
                },
              }),
            ],
            totals: { alerting: 1 },
            totalsFiltered: { alerting: 1 },
          }),
        ],
        interval: 20,
      },
    ],
    totals: {
      alerting: 2,
    },
  },
};
const rulerResponse = {
  default: [
    mockRulerRuleGroup({
      name: 'mygroup',
      rules: [
        mockRulerAlertingRule({
          alert: 'dashboardrule1',
          annotations: {
            [Annotation.dashboardUID]: '12',
            [Annotation.panelID]: '34',
          },
        }),
      ],
    }),
    {
      name: 'othergroup',
      rules: [
        mockRulerAlertingRule({
          alert: 'dashboardrule2',
          annotations: {
            [Annotation.dashboardUID]: '121',
            [Annotation.panelID]: '341',
          },
        }),
      ],
    },
  ],
};

const dashboard = {
  uid: '12',
  time: {
    from: 'now-6h',
    to: 'now',
  },
  meta: {
    canSave: true,
    folderUid: 'abc',
    folderTitle: 'super folder',
  },
} as DashboardModel;

const panel = new PanelModel({
  datasource: {
    type: 'prometheus',
    uid: dataSources.prometheus.uid,
  },
  title: 'mypanel',
  id: 34,
  targets: [
    {
      expr: 'sum(some_metric [$__interval])) by (app)',
      refId: 'A',
    },
  ],
});

const ui = {
  row: byTestId('row'),
  createButton: byTestId<HTMLAnchorElement>('create-alert-rule-button'),
  notSavedYet: byText('Dashboard not saved'),
};

const server = setupMswServer();

describe('PanelAlertTabContent', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);
    setupDataSources(...Object.values(dataSources));

    setPluginLinksHook(() => ({
      links: [],
      isLoading: false,
    }));

    mocks.rulerBuilderMock.mockReturnValue({
      rules: () => ({ path: `api/ruler/${GRAFANA_RULES_SOURCE_NAME}/api/v1/rules` }),
      namespace: () => ({ path: 'ruler' }),
      namespaceGroup: () => ({ path: 'ruler' }),
    });
    mocks.useAlertRuleAbilityMock.mockReturnValue([true, true]);

    mockAlertRuleApi(server).prometheusRuleNamespaces(GRAFANA_RULES_SOURCE_NAME, promResponse);
    mockAlertRuleApi(server).rulerRules(GRAFANA_RULES_SOURCE_NAME, rulerResponse);
    config.unifiedAlertingEnabled = true;
  });

  it('Will take into account panel maxDataPoints', async () => {
    renderAlertTabContent(
      dashboard,
      new PanelModel({
        ...panel,
        maxDataPoints: 100,
        interval: '10s',
      })
    );

    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);

    const defaults = JSON.parse(decodeURIComponent(match![1]));
    expect(defaults.queries[0].model).toEqual({
      expr: 'sum(some_metric [5m])) by (app)',
      refId: 'A',
      datasource: {
        type: 'prometheus',
        uid: 'mock-ds-2',
      },
      interval: '',
      intervalMs: 300000,
      maxDataPoints: 100,
    });
  });

  it('Will work with default datasource', async () => {
    renderAlertTabContent(
      dashboard,
      new PanelModel({
        ...panel,
        datasource: undefined,
        maxDataPoints: 100,
        interval: '10s',
      })
    );

    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);

    const defaults = JSON.parse(decodeURIComponent(match![1]));
    expect(defaults.queries[0].model).toEqual({
      expr: 'sum(some_metric [5m])) by (app)',
      refId: 'A',
      datasource: {
        type: 'prometheus',
        uid: 'mock-ds-3',
      },
      interval: '',
      intervalMs: 300000,
      maxDataPoints: 100,
    });
  });

  it('should not make requests for unsaved dashboard', async () => {
    const capture = captureRequests();

    const unsavedDashboard = {
      ...dashboard,
      uid: null,
    } as DashboardModel;

    renderAlertTabContent(
      unsavedDashboard,
      new PanelModel({
        ...panel,
        datasource: undefined,
        maxDataPoints: 100,
        interval: '10s',
      })
    );

    expect(await ui.notSavedYet.find()).toBeInTheDocument();
    const requests = await capture;
    expect(requests.length).toBe(0);
  });

  it('Will take into account datasource minInterval', async () => {
    renderAlertTabContent(
      dashboard,
      new PanelModel({
        ...panel,
        maxDataPoints: 100,
        datasource: {
          type: 'prometheus',
          uid: dataSources.prometheusMinInterval.uid,
        },
      })
    );

    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);

    const defaults = JSON.parse(decodeURIComponent(match![1]));
    expect(defaults.queries[0].model).toEqual({
      expr: 'sum(some_metric [7m])) by (app)',
      refId: 'A',
      datasource: {
        type: 'prometheus',
        uid: 'mock-ds-4',
      },
      interval: '',
      intervalMs: 420000,
      maxDataPoints: 100,
    });
  });

  it('Will render alerts belonging to panel and a button to create alert from panel queries', async () => {
    config.unifiedAlertingEnabled = true;
    renderAlertTabContent(dashboard, panel);

    const rows = await ui.row.findAll();
    // after updating to RTKQ, the response is already returning the alerts belonging to the panel
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/dashboardrule1/);
    expect(rows[0]).not.toHaveTextContent(/dashboardrule2/);

    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);

    const defaults = JSON.parse(decodeURIComponent(match![1]));
    const defaultsWithDeterministicTime: Partial<RuleFormValues> = {
      ...defaults,
      queries: defaults.queries.map((q: AlertQuery) => {
        return {
          ...q,
          // Fix computed time stamp to avoid assertion flakiness
          ...(q.relativeTimeRange ? { relativeTimeRange: { from: 21600, to: 0 } } : {}),
        };
      }),
    };

    expect(defaultsWithDeterministicTime).toMatchSnapshot();
  });
});
