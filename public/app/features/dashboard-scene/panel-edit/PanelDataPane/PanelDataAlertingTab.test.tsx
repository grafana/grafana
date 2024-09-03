import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { byTestId } from 'testing-library-selector';

import { DataSourceApi } from '@grafana/data';
import { PromOptions, PrometheusDatasource } from '@grafana/prometheus';
import { locationService, setDataSourceSrv, setPluginExtensionsHook } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import * as ruler from 'app/features/alerting/unified/api/ruler';
import * as ruleActionButtons from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import * as alertingAbilities from 'app/features/alerting/unified/hooks/useAbilities';
import { mockAlertRuleApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  MockDataSourceSrv,
  grantUserPermissions,
  mockDataSource,
  mockFolder,
  mockPromAlert,
  mockPromAlertingRule,
  mockRulerAlertingRule,
  mockRulerRuleGroup,
} from 'app/features/alerting/unified/mocks';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import * as config from 'app/features/alerting/unified/utils/config';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, DashboardDataDTO } from 'app/types';
import { AlertQuery, PromRulesResponse } from 'app/types/unified-alerting-dto';

import { createDashboardSceneFromDashboardModel } from '../../serialization/transformSaveModelToScene';
import * as utils from '../../utils/utils';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';

import { PanelDataAlertingTab, PanelDataAlertingTabRendered } from './PanelDataAlertingTab';

/**
 * These tests has been copied from public/app/features/alerting/unified/PanelAlertTabContent.test.tsx and been slightly modified to make sure the scenes alert edit tab is as close to the old alert edit tab as possible
 */

jest.mock('app/features/alerting/unified/api/prometheus');
jest.mock('app/features/alerting/unified/api/ruler');

jest.spyOn(config, 'getAllDataSources');
jest.spyOn(ruleActionButtons, 'matchesWidth').mockReturnValue(false);
jest.spyOn(ruler, 'rulerUrlBuilder');
jest.spyOn(alertingAbilities, 'useAlertRuleAbility');

setPluginExtensionsHook(() => ({
  extensions: [],
  isLoading: false,
}));

const dataSources = {
  prometheus: mockDataSource<PromOptions>({
    name: 'Prometheus',
    type: DataSourceType.Prometheus,
    isDefault: false,
  }),
  default: mockDataSource<PromOptions>({
    name: 'Default',
    type: DataSourceType.Prometheus,
    isDefault: true,
  }),
};
dataSources.prometheus.meta.alerting = true;
dataSources.default.meta.alerting = true;

const mocks = {
  getAllDataSources: jest.mocked(config.getAllDataSources),
  useAlertRuleAbilityMock: jest.mocked(alertingAbilities.useAlertRuleAbility),
  rulerBuilderMock: jest.mocked(ruler.rulerUrlBuilder),
};

const renderAlertTabContent = (model: PanelDataAlertingTab, initialStore?: ReturnType<typeof configureStore>) => {
  render(
    <TestProvider store={initialStore}>
      <PanelDataAlertingTabRendered model={model}></PanelDataAlertingTabRendered>
    </TestProvider>
  );
};

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

const dashboard = {
  uid: '12',
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: { refresh_intervals: ['5s', '30s', '1m'] },
  meta: {
    canSave: true,
    folderId: 1,
    folderTitle: 'super folder',
  },
  isSnapshot: () => false,
} as unknown as DashboardModel;

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
  createButton: byTestId<HTMLButtonElement>('create-alert-rule-button'),
};
const server = setupMswServer();

describe('PanelAlertTabContent', () => {
  // silenceConsoleOutput();
  beforeEach(() => {
    jest.resetAllMocks();
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);

    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValue(mockFolder());

    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    const dsService = new MockDataSourceSrv(dataSources);
    dsService.datasources[dataSources.prometheus.uid] = new PrometheusDatasource(
      dataSources.prometheus
    ) as DataSourceApi;
    dsService.datasources[dataSources.default.uid] = new PrometheusDatasource(dataSources.default) as DataSourceApi;
    setDataSourceSrv(dsService);
    mocks.rulerBuilderMock.mockReturnValue({
      rules: () => ({ path: `api/ruler/${GRAFANA_RULES_SOURCE_NAME}/api/v1/rules` }),
      namespace: () => ({ path: 'ruler' }),
      namespaceGroup: () => ({ path: 'ruler' }),
    });
    mocks.useAlertRuleAbilityMock.mockReturnValue([true, true]);

    mockAlertRuleApi(server).prometheusRuleNamespaces(GRAFANA_RULES_SOURCE_NAME, promResponse);
    mockAlertRuleApi(server).rulerRules(GRAFANA_RULES_SOURCE_NAME, {
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
    });
  });

  it('Will take into account panel maxDataPoints', async () => {
    dashboard.panels = [
      new PanelModel({
        ...panel,
        maxDataPoints: 100,
        interval: '10s',
      }),
    ];

    renderAlertTab(dashboard);

    const defaults = await clickNewButton();

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
    dashboard.panels = [
      new PanelModel({
        ...panel,
        datasource: undefined,
        maxDataPoints: 100,
        interval: '10s',
      }),
    ];

    renderAlertTab(dashboard);
    const defaults = await clickNewButton();

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

  it('Will take into account datasource minInterval', async () => {
    (getDatasourceSrv() as unknown as MockDataSourceSrv).datasources[dataSources.prometheus.uid].interval = '7m';

    dashboard.panels = [
      new PanelModel({
        ...panel,
        maxDataPoints: 100,
      }),
    ];

    renderAlertTab(dashboard);
    const defaults = await clickNewButton();

    expect(defaults.queries[0].model).toEqual({
      expr: 'sum(some_metric [7m])) by (app)',
      refId: 'A',
      datasource: {
        type: 'prometheus',
        uid: 'mock-ds-2',
      },
      interval: '',
      intervalMs: 420000,
      maxDataPoints: 100,
    });
  });

  // after updating to RTKQ, the response is already returning the alerts belonging to the panel
  it('Will render alerts belonging to panel and a button to create alert from panel queries', async () => {
    dashboard.panels = [panel];

    renderAlertTab(dashboard);

    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/dashboardrule1/);
    expect(rows[1]).toHaveTextContent(/dashboardrule2/);

    const defaults = await clickNewButton();

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

function renderAlertTab(dashboard: DashboardModel) {
  const model = createModel(dashboard);
  renderAlertTabContent(model);
}

async function clickNewButton() {
  const pushMock = jest.fn();
  const oldPush = locationService.push;
  locationService.push = pushMock;
  const button = await ui.createButton.find();
  await act(async () => {
    await userEvent.click(button);
  });
  const match = pushMock.mock.lastCall[0].match(/alerting\/new\?defaults=(.*)&returnTo=/);
  const defaults = JSON.parse(decodeURIComponent(match![1]));
  locationService.push = oldPush;
  return defaults;
}

function createModel(dashboard: DashboardModel) {
  const scene = createDashboardSceneFromDashboardModel(dashboard, {} as DashboardDataDTO);
  const vizPanel = findVizPanelByKey(scene, getVizPanelKeyForPanelId(34))!;
  const model = new PanelDataAlertingTab(VizPanelManager.createFor(vizPanel));
  jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue(scene);
  return model;
}
