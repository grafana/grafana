import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byTestId } from 'testing-library-selector';

import { DataSourceApi } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import * as ruleActionButtons from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { toggleOption } from 'app/features/variables/pickers/OptionsPicker/reducer';
import { toKeyedAction } from 'app/features/variables/state/keyedVariablesReducer';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { PromOptions } from 'app/plugins/datasource/prometheus/types';
import { configureStore } from 'app/store/configureStore';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { PanelAlertTabContent } from './PanelAlertTabContent';
import { fetchRules } from './api/prometheus';
import { fetchRulerRules } from './api/ruler';
import {
  disableRBAC,
  mockDataSource,
  MockDataSourceSrv,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  mockRulerGrafanaRule,
} from './mocks';
import { RuleFormValues } from './types/rule-form';
import * as config from './utils/config';
import { Annotation } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import * as ruleFormUtils from './utils/rule-form';

jest.mock('./api/prometheus');
jest.mock('./api/ruler');
jest.mock('../../../core/hooks/useMediaQueryChange');

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

const renderAlertTabContent = (
  dashboard: DashboardModel,
  panel: PanelModel,
  initialStore?: ReturnType<typeof configureStore>
) => {
  return act(async () => {
    render(
      <TestProvider store={initialStore}>
        <PanelAlertTabContent dashboard={dashboard} panel={panel} />
      </TestProvider>
    );
  });
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
};

describe('PanelAlertTabContent', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    const dsService = new MockDataSourceSrv(dataSources);
    dsService.datasources[dataSources.prometheus.uid] = new PrometheusDatasource(
      dataSources.prometheus
    ) as DataSourceApi<any, any>;
    dsService.datasources[dataSources.default.uid] = new PrometheusDatasource(dataSources.default) as DataSourceApi<
      any,
      any
    >;
    setDataSourceSrv(dsService);
    disableRBAC();
  });

  it('Will take into account panel maxDataPoints', async () => {
    await renderAlertTabContent(
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
    await renderAlertTabContent(
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

  it('Will take into account datasource minInterval', async () => {
    (getDatasourceSrv() as unknown as MockDataSourceSrv).datasources[dataSources.prometheus.uid].interval = '7m';

    await renderAlertTabContent(
      dashboard,
      new PanelModel({
        ...panel,
        maxDataPoints: 100,
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
    expect(mocks.api.fetchRules).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
      dashboardUID: dashboard.uid,
      panelId: panel.id,
    });
  });

  it('Update NewRuleFromPanel button url when template changes', async () => {
    const panelToRuleValuesSpy = jest.spyOn(ruleFormUtils, 'panelToRuleFormValues');

    const store = configureStore();
    await renderAlertTabContent(dashboard, panel, store);

    store.dispatch(
      toKeyedAction(
        'optionKey',
        toggleOption({
          option: { value: 'optionValue', selected: true, text: 'Option' },
          clearOthers: false,
          forceSelect: false,
        })
      )
    );

    await waitFor(() => expect(panelToRuleValuesSpy).toHaveBeenCalledTimes(2));
  });
});
