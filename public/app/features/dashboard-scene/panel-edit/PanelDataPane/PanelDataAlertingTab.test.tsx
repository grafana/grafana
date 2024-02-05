import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byTestId } from 'testing-library-selector';

import { DataSourceApi } from '@grafana/data';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { fetchRules } from 'app/features/alerting/unified/api/prometheus';
import { fetchRulerRules } from 'app/features/alerting/unified/api/ruler';
import * as ruleActionButtons from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import {
  MockDataSourceSrv,
  grantUserPermissions,
  mockDataSource,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  mockRulerGrafanaRule,
} from 'app/features/alerting/unified/mocks';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import * as config from 'app/features/alerting/unified/utils/config';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { PromOptions } from 'app/plugins/datasource/prometheus/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { createDashboardSceneFromDashboardModel } from '../../serialization/transformSaveModelToScene';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from '../../utils/utils';
import * as utils from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';

import { PanelDataAlertingTab, PanelDataAlertingTabRendered } from './PanelDataAlertingTab';

/**
 * These tests has been copied from public/app/features/alerting/unified/PanelAlertTabContent.test.tsx and been slightly modified to make sure the scenes alert edit tab is as close to the old alert edit tab as possible
 */

jest.mock('app/features/alerting/unified/api/prometheus');
jest.mock('app/features/alerting/unified/api/ruler');

jest.spyOn(config, 'getAllDataSources');
jest.spyOn(ruleActionButtons, 'matchesWidth').mockReturnValue(false);

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
  api: {
    fetchRules: jest.mocked(fetchRules),
    fetchRulerRules: jest.mocked(fetchRulerRules),
  },
};

const renderAlertTabContent = (model: PanelDataAlertingTab, initialStore?: ReturnType<typeof configureStore>) => {
  render(
    <TestProvider store={initialStore}>
      <PanelDataAlertingTabRendered model={model}></PanelDataAlertingTabRendered>
    </TestProvider>
  );
};

const rules = [
  mockPromRuleNamespace({
    name: 'default',
    groups: [
      mockPromRuleGroup({
        name: 'mygroup',
        rules: [
          mockPromAlertingRule({
            name: 'dashboardrule1',
            annotations: {
              [Annotation.dashboardUID]: '12',
              [Annotation.panelID]: '34',
            },
          }),
        ],
      }),
      mockPromRuleGroup({
        name: 'othergroup',
        rules: [
          mockPromAlertingRule({
            name: 'dashboardrule2',
            annotations: {
              [Annotation.dashboardUID]: '121',
              [Annotation.panelID]: '341',
            },
          }),
        ],
      }),
    ],
  }),
];

const rulerRules = {
  default: [
    {
      name: 'mygroup',
      rules: [
        mockRulerGrafanaRule(
          {
            annotations: {
              [Annotation.dashboardUID]: '12',
              [Annotation.panelID]: '34',
            },
          },
          {
            title: 'dashboardrule1',
          }
        ),
      ],
    },
    {
      name: 'othergroup',
      rules: [
        mockRulerGrafanaRule(
          {
            annotations: {
              [Annotation.dashboardUID]: '121',
              [Annotation.panelID]: '341',
            },
          },
          {
            title: 'dashboardrule2',
          }
        ),
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
  timepicker: { refresh_intervals: 5 },
  meta: {
    canSave: true,
    folderId: 1,
    folderTitle: 'super folder',
  },
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

describe('PanelAlertTabContent', () => {
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
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    const dsService = new MockDataSourceSrv(dataSources);
    dsService.datasources[dataSources.prometheus.uid] = new PrometheusDatasource(
      dataSources.prometheus
    ) as DataSourceApi;
    dsService.datasources[dataSources.default.uid] = new PrometheusDatasource(dataSources.default) as DataSourceApi;
    setDataSourceSrv(dsService);
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

  it('Will render alerts belonging to panel and a button to create alert from panel queries', async () => {
    mocks.api.fetchRules.mockResolvedValue(rules);
    mocks.api.fetchRulerRules.mockResolvedValue(rulerRules);

    dashboard.panels = [panel];

    renderAlertTab(dashboard);

    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/dashboardrule1/);
    expect(rows[0]).not.toHaveTextContent(/dashboardrule2/);

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

    expect(mocks.api.fetchRulerRules).toHaveBeenCalledWith(
      { dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' },
      {
        dashboardUID: dashboard.uid,
        panelId: panel.id,
      }
    );
    expect(mocks.api.fetchRules).toHaveBeenCalledWith(
      GRAFANA_RULES_SOURCE_NAME,
      {
        dashboardUID: dashboard.uid,
        panelId: panel.id,
      },
      undefined,
      undefined,
      undefined,
      undefined
    );
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
  const scene = createDashboardSceneFromDashboardModel(dashboard);
  const vizPanel = findVizPanelByKey(scene, getVizPanelKeyForPanelId(34));
  const model = new PanelDataAlertingTab(new VizPanelManager(vizPanel!.clone()));
  jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue(scene);
  return model;
}
