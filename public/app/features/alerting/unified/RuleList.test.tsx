import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { RuleList } from './RuleList';
import { byRole, byTestId, byText } from 'testing-library-selector';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRules } from './api/prometheus';
import {
  mockDataSource,
  mockPromAlert,
  mockPromAlertingRule,
  mockPromRecordingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  MockDataSourceSrv,
} from './mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { SerializedError } from '@reduxjs/toolkit';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import userEvent from '@testing-library/user-event';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { Router } from 'react-router-dom';

jest.mock('./api/prometheus');
jest.mock('./utils/config');

const mocks = {
  getAllDataSourcesMock: typeAsJestMock(getAllDataSources),

  api: {
    fetchRules: typeAsJestMock(fetchRules),
  },
};

const renderRuleList = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <RuleList />
      </Router>
    </Provider>
  );
};

const dataSources = {
  prom: mockDataSource({
    name: 'Prometheus',
    type: DataSourceType.Prometheus,
  }),
  promdisabled: mockDataSource({
    name: 'Prometheus-disabled',
    type: DataSourceType.Prometheus,
    jsonData: {
      manageAlerts: false,
    },
  }),
  loki: mockDataSource({
    name: 'Loki',
    type: DataSourceType.Loki,
  }),
  promBroken: mockDataSource({
    name: 'Prometheus-broken',
    type: DataSourceType.Prometheus,
  }),
};

const ui = {
  ruleGroup: byTestId('rule-group'),
  cloudRulesSourceErrors: byTestId('cloud-rulessource-errors'),
  groupCollapseToggle: byTestId('group-collapse-toggle'),
  ruleCollapseToggle: byTestId('collapse-toggle'),
  rulesTable: byTestId('rules-table'),
  ruleRow: byTestId('row'),
  expandedContent: byTestId('expanded-content'),
  rulesFilterInput: byTestId('search-query-input'),
  moreErrorsButton: byRole('button', { name: /more errors/ }),
};

describe('RuleList', () => {
  afterEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(undefined as any);
  });

  it('load & show rule groups from multiple cloud data sources', async () => {
    mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));

    setDataSourceSrv(new MockDataSourceSrv(dataSources));

    mocks.api.fetchRules.mockImplementation((dataSourceName: string) => {
      if (dataSourceName === dataSources.prom.name) {
        return Promise.resolve([
          mockPromRuleNamespace({
            name: 'default',
            dataSourceName: dataSources.prom.name,
            groups: [
              mockPromRuleGroup({
                name: 'group-2',
              }),
              mockPromRuleGroup({
                name: 'group-1',
              }),
            ],
          }),
        ]);
      } else if (dataSourceName === dataSources.loki.name) {
        return Promise.resolve([
          mockPromRuleNamespace({
            name: 'default',
            dataSourceName: dataSources.loki.name,
            groups: [
              mockPromRuleGroup({
                name: 'group-1',
              }),
            ],
          }),
          mockPromRuleNamespace({
            name: 'lokins',
            dataSourceName: dataSources.loki.name,
            groups: [
              mockPromRuleGroup({
                name: 'group-1',
              }),
            ],
          }),
        ]);
      } else if (dataSourceName === dataSources.promBroken.name) {
        return Promise.reject({ message: 'this datasource is broken' } as SerializedError);
      } else if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return Promise.resolve([
          mockPromRuleNamespace({
            name: 'foofolder',
            dataSourceName: GRAFANA_RULES_SOURCE_NAME,
            groups: [
              mockPromRuleGroup({
                name: 'grafana-group',
                rules: [
                  mockPromAlertingRule({
                    query: '[]',
                  }),
                ],
              }),
            ],
          }),
        ]);
      }
      return Promise.reject(new Error(`unexpected datasourceName: ${dataSourceName}`));
    });

    await renderRuleList();

    await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(4));
    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(5);

    expect(groups[0]).toHaveTextContent('foofolder');
    expect(groups[1]).toHaveTextContent('default > group-1');
    expect(groups[2]).toHaveTextContent('default > group-1');
    expect(groups[3]).toHaveTextContent('default > group-2');
    expect(groups[4]).toHaveTextContent('lokins > group-1');

    const errors = await ui.cloudRulesSourceErrors.find();

    expect(errors).not.toHaveTextContent(
      'Failed to load rules state from Prometheus-broken: this datasource is broken'
    );
    userEvent.click(ui.moreErrorsButton.get());
    expect(errors).toHaveTextContent('Failed to load rules state from Prometheus-broken: this datasource is broken');
  });

  it('expand rule group, rule and alert details', async () => {
    mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
    setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));
    mocks.api.fetchRules.mockImplementation((dataSourceName: string) => {
      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return Promise.resolve([]);
      } else {
        return Promise.resolve([
          mockPromRuleNamespace({
            groups: [
              mockPromRuleGroup({
                name: 'group-1',
              }),
              mockPromRuleGroup({
                name: 'group-2',
                rules: [
                  mockPromRecordingRule({
                    name: 'recordingrule',
                  }),
                  mockPromAlertingRule({
                    name: 'alertingrule',
                    labels: {
                      severity: 'warning',
                      foo: 'bar',
                    },
                    query: 'topk(5, foo)[5m]',
                    annotations: {
                      message: 'great alert',
                    },
                    alerts: [
                      mockPromAlert({
                        labels: {
                          foo: 'bar',
                          severity: 'warning',
                        },
                        value: '2e+10',
                        annotations: {
                          message: 'first alert message',
                        },
                      }),
                      mockPromAlert({
                        labels: {
                          foo: 'baz',
                          severity: 'error',
                        },
                        value: '3e+11',
                        annotations: {
                          message: 'first alert message',
                        },
                      }),
                    ],
                  }),
                  mockPromAlertingRule({
                    name: 'p-rule',
                    alerts: [],
                    state: PromAlertingRuleState.Pending,
                  }),
                  mockPromAlertingRule({
                    name: 'i-rule',
                    alerts: [],
                    state: PromAlertingRuleState.Inactive,
                  }),
                ],
              }),
            ],
          }),
        ]);
      }
    });

    await renderRuleList();

    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('1 rule');
    expect(groups[1]).toHaveTextContent('4 rules: 1 firing, 1 pending');

    // expand second group to see rules table
    expect(ui.rulesTable.query()).not.toBeInTheDocument();
    userEvent.click(ui.groupCollapseToggle.get(groups[1]));
    const table = await ui.rulesTable.find(groups[1]);

    // check that rule rows are rendered properly
    let ruleRows = ui.ruleRow.getAll(table);
    expect(ruleRows).toHaveLength(4);

    expect(ruleRows[0]).toHaveTextContent('Recording rule');
    expect(ruleRows[0]).toHaveTextContent('recordingrule');

    expect(ruleRows[1]).toHaveTextContent('Firing');
    expect(ruleRows[1]).toHaveTextContent('alertingrule');

    expect(ruleRows[2]).toHaveTextContent('Pending');
    expect(ruleRows[2]).toHaveTextContent('p-rule');

    expect(ruleRows[3]).toHaveTextContent('Normal');
    expect(ruleRows[3]).toHaveTextContent('i-rule');

    expect(byText('Labels').query()).not.toBeInTheDocument();

    // expand alert details
    userEvent.click(ui.ruleCollapseToggle.get(ruleRows[1]));

    const ruleDetails = ui.expandedContent.get(ruleRows[1]);

    expect(ruleDetails).toHaveTextContent('Labelsseverity=warningfoo=bar');
    expect(ruleDetails).toHaveTextContent('Expressiontopk ( 5 , foo ) [ 5m ]');
    expect(ruleDetails).toHaveTextContent('messagegreat alert');
    expect(ruleDetails).toHaveTextContent('Matching instances');

    // finally, check instances table
    const instancesTable = byTestId('dynamic-table').get(ruleDetails);
    expect(instancesTable).toBeInTheDocument();
    const instanceRows = byTestId('row').getAll(instancesTable);
    expect(instanceRows).toHaveLength(2);

    expect(instanceRows![0]).toHaveTextContent('Firingfoo=barseverity=warning2021-03-18 13:47:05');
    expect(instanceRows![1]).toHaveTextContent('Firingfoo=bazseverity=error2021-03-18 13:47:05');

    // expand details of an instance
    userEvent.click(ui.ruleCollapseToggle.get(instanceRows![0]));

    const alertDetails = byTestId('expanded-content').get(instanceRows[0]);
    expect(alertDetails).toHaveTextContent('Value2e+10');
    expect(alertDetails).toHaveTextContent('messagefirst alert message');

    // collapse everything again
    userEvent.click(ui.ruleCollapseToggle.get(instanceRows![0]));
    expect(byTestId('expanded-content').query(instanceRows[0])).not.toBeInTheDocument();
    userEvent.click(ui.ruleCollapseToggle.getAll(ruleRows[1])[0]);
    userEvent.click(ui.groupCollapseToggle.get(groups[1]));
    expect(ui.rulesTable.query()).not.toBeInTheDocument();
  });

  it('filters rules and alerts by labels', async () => {
    mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
    setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));

    mocks.api.fetchRules.mockImplementation((dataSourceName: string) => {
      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return Promise.resolve([]);
      } else {
        return Promise.resolve([
          mockPromRuleNamespace({
            groups: [
              mockPromRuleGroup({
                name: 'group-1',
                rules: [
                  mockPromAlertingRule({
                    name: 'alertingrule',
                    labels: {
                      severity: 'warning',
                      foo: 'bar',
                    },
                    query: 'topk(5, foo)[5m]',
                    annotations: {
                      message: 'great alert',
                    },
                    alerts: [
                      mockPromAlert({
                        labels: {
                          foo: 'bar',
                          severity: 'warning',
                        },
                        value: '2e+10',
                        annotations: {
                          message: 'first alert message',
                        },
                      }),
                      mockPromAlert({
                        labels: {
                          foo: 'baz',
                          severity: 'error',
                        },
                        value: '3e+11',
                        annotations: {
                          message: 'first alert message',
                        },
                      }),
                    ],
                  }),
                ],
              }),
              mockPromRuleGroup({
                name: 'group-2',
                rules: [
                  mockPromAlertingRule({
                    name: 'alertingrule2',
                    labels: {
                      severity: 'error',
                      foo: 'buzz',
                    },
                    query: 'topk(5, foo)[5m]',
                    annotations: {
                      message: 'great alert',
                    },
                    alerts: [
                      mockPromAlert({
                        labels: {
                          foo: 'buzz',
                          severity: 'error',
                          region: 'EU',
                        },
                        value: '2e+10',
                        annotations: {
                          message: 'alert message',
                        },
                      }),
                      mockPromAlert({
                        labels: {
                          foo: 'buzz',
                          severity: 'error',
                          region: 'US',
                        },
                        value: '3e+11',
                        annotations: {
                          message: 'alert message',
                        },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]);
      }
    });

    await renderRuleList();
    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(2);

    const filterInput = ui.rulesFilterInput.get();
    userEvent.type(filterInput, '{foo="bar"}');

    // Input is debounced so wait for it to be visible
    waitFor(() => expect(filterInput).toHaveTextContent('{foo="bar"}'));
    // Group doesn't contain matching labels
    waitFor(() => expect(groups[1]).not.toBeVisible());
    expect(groups[0]).toBeVisible();

    userEvent.click(ui.groupCollapseToggle.get(groups[0]));

    const ruleRows = ui.ruleRow.getAll(groups[0]);
    expect(ruleRows).toHaveLength(1);

    userEvent.click(ui.ruleCollapseToggle.get(ruleRows[0]));
    const ruleDetails = ui.expandedContent.get(ruleRows[0]);

    expect(ruleDetails).toHaveTextContent('Labelsseverity=warningfoo=bar');

    // Check for different label matchers
    userEvent.type(filterInput, '{foo!="bar"}');
    waitFor(() => expect(filterInput).toHaveTextContent('{foo!="bar"}'));
    // Group doesn't contain matching labels
    waitFor(() => expect(groups[0]).not.toBeVisible());
    expect(groups[1]).toBeVisible();

    userEvent.type(filterInput, '{foo=~"b.+"}');
    waitFor(() => expect(filterInput).toHaveTextContent('{foo=~"b.+"}'));
    expect(groups[0]).toBeVisible();
    expect(groups[1]).toBeVisible();

    userEvent.type(filterInput, '{region="US"}');
    waitFor(() => expect(filterInput).toHaveTextContent('{region="US"}'));
    waitFor(() => expect(groups[0]).not.toBeVisible());
    expect(groups[1]).toBeVisible();
  });
});
