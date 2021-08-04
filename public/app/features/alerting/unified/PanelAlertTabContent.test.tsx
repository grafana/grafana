import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { render } from '@testing-library/react';
import { PanelAlertTabContent } from './PanelAlertTabContent';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import {
  mockDataSource,
  MockDataSourceSrv,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  mockRulerGrafanaRule,
} from './mocks';
import { DataSourceType } from './utils/datasource';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRules } from './api/prometheus';
import { fetchRulerRules } from './api/ruler';
import { Annotation } from './utils/constants';
import { byTestId } from 'testing-library-selector';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { DataSourceApi } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

jest.mock('./api/prometheus');
jest.mock('./api/ruler');
jest.mock('./utils/config');

const dataSources = {
  prometheus: mockDataSource({
    name: 'Prometheus',
    type: DataSourceType.Prometheus,
  }),
};
dataSources.prometheus.meta.alerting = true;

const mocks = {
  getAllDataSources: typeAsJestMock(getAllDataSources),
  api: {
    fetchRules: typeAsJestMock(fetchRules),
    fetchRulerRules: typeAsJestMock(fetchRulerRules),
  },
};

const renderAlertTabContent = (dashboard: DashboardModel, panel: PanelModel) => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <PanelAlertTabContent dashboard={dashboard} panel={panel} />
      </Router>
    </Provider>
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
  meta: {
    canSave: true,
    folderId: 1,
    folderTitle: 'super folder',
  },
} as DashboardModel;
const panel = ({
  datasource: dataSources.prometheus.uid,
  title: 'mypanel',
  editSourceId: 34,
  targets: [
    {
      expr: 'sum(some_metric [$__interval])) by (app)',
      refId: 'A',
    },
  ],
} as any) as PanelModel;

const ui = {
  row: byTestId('row'),
  createButton: byTestId<HTMLAnchorElement>('create-alert-rule-button'),
};

describe('PanelAlertTabContent', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    const dsService = new MockDataSourceSrv(dataSources);
    dsService.datasources[dataSources.prometheus.name] = new PrometheusDatasource(
      dataSources.prometheus
    ) as DataSourceApi<any, any>;
    setDataSourceSrv(dsService);
  });

  it('Will take into account panel maxDataPoints', async () => {
    await renderAlertTabContent(dashboard, ({
      ...panel,
      maxDataPoints: 100,
      interval: '10s',
    } as any) as PanelModel);
    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);
    const defaults = JSON.parse(decodeURIComponent(match![1]));
    expect(defaults.queries[0].model).toEqual({
      expr: 'sum(some_metric [5m])) by (app)',
      refId: 'A',
      datasource: 'Prometheus',
      interval: '',
      intervalMs: 300000,
      maxDataPoints: 100,
    });
  });

  it('Will take into account datasource minInterval', async () => {
    ((getDatasourceSrv() as any) as MockDataSourceSrv).datasources[dataSources.prometheus.name].interval = '7m';

    await renderAlertTabContent(dashboard, ({
      ...panel,
      maxDataPoints: 100,
    } as any) as PanelModel);
    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);
    const defaults = JSON.parse(decodeURIComponent(match![1]));
    expect(defaults.queries[0].model).toEqual({
      expr: 'sum(some_metric [7m])) by (app)',
      refId: 'A',
      datasource: 'Prometheus',
      interval: '',
      intervalMs: 420000,
      maxDataPoints: 100,
    });
  });

  it('Will render alerts belonging to panel and a button to create alert from panel queries', async () => {
    mocks.api.fetchRules.mockResolvedValue(rules);
    mocks.api.fetchRulerRules.mockResolvedValue(rulerRules);

    await renderAlertTabContent(dashboard, panel);

    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/dashboardrule1/);
    expect(rows[0]).not.toHaveTextContent(/dashboardrule2/);
    const button = await ui.createButton.find();
    const href = button.href;
    const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
    expect(match).toHaveLength(2);
    const defaults = JSON.parse(decodeURIComponent(match![1]));
    expect(defaults).toEqual({
      type: 'grafana',
      folder: { id: 1, title: 'super folder' },
      queries: [
        {
          refId: 'A',
          queryType: '',
          relativeTimeRange: { from: 21600, to: 0 },
          datasourceUid: 'mock-ds-2',
          model: {
            expr: 'sum(some_metric [15s])) by (app)',
            refId: 'A',
            datasource: 'Prometheus',
            interval: '',
            intervalMs: 15000,
          },
        },
        {
          refId: 'B',
          datasourceUid: '-100',
          queryType: '',
          model: {
            refId: 'B',
            hide: false,
            type: 'classic_conditions',
            datasource: '__expr__',
            conditions: [
              {
                type: 'query',
                evaluator: { params: [3], type: 'gt' },
                operator: { type: 'and' },
                query: { params: ['A'] },
                reducer: { params: [], type: 'last' },
              },
            ],
          },
        },
      ],
      name: 'mypanel',
      condition: 'B',
      annotations: [
        { key: '__dashboardUid__', value: '12' },
        { key: '__panelId__', value: '34' },
      ],
    });
  });
});
