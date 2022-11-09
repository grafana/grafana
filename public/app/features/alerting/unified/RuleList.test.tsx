import { SerializedError } from '@reduxjs/toolkit';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { locationService, setDataSourceSrv, logInfo } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import * as ruleActionButtons from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import * as actions from 'app/features/alerting/unified/state/actions';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { PromAlertingRuleState, PromApplication } from 'app/types/unified-alerting-dto';

import { LogMessages } from './Analytics';
import RuleList from './RuleList';
import { discoverFeatures } from './api/buildInfo';
import { fetchRules } from './api/prometheus';
import { deleteNamespace, deleteRulerRulesGroup, fetchRulerRules, setRulerRuleGroup } from './api/ruler';
import {
  disableRBAC,
  enableRBAC,
  grantUserPermissions,
  mockDataSource,
  MockDataSourceSrv,
  mockPromAlert,
  mockPromAlertingRule,
  mockPromRecordingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  somePromRules,
  someRulerRules,
} from './mocks';
import * as config from './utils/config';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

jest.mock('./api/buildInfo');
jest.mock('./api/prometheus');
jest.mock('./api/ruler');
jest.mock('../../../core/hooks/useMediaQueryChange');
jest.spyOn(ruleActionButtons, 'matchesWidth').mockReturnValue(false);
jest.mock('app/core/core', () => ({
  appEvents: {
    subscribe: () => {
      return { unsubscribe: () => {} };
    },
    emit: () => {},
  },
}));
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    logInfo: jest.fn(),
  };
});

jest.spyOn(config, 'getAllDataSources');
jest.spyOn(actions, 'rulesInSameGroupHaveInvalidFor').mockReturnValue([]);

const mocks = {
  getAllDataSourcesMock: jest.mocked(config.getAllDataSources),
  rulesInSameGroupHaveInvalidForMock: jest.mocked(actions.rulesInSameGroupHaveInvalidFor),

  api: {
    discoverFeatures: jest.mocked(discoverFeatures),
    fetchRules: jest.mocked(fetchRules),
    fetchRulerRules: jest.mocked(fetchRulerRules),
    deleteGroup: jest.mocked(deleteRulerRulesGroup),
    deleteNamespace: jest.mocked(deleteNamespace),
    setRulerRuleGroup: jest.mocked(setRulerRuleGroup),
  },
};

const renderRuleList = () => {
  const store = configureStore();
  locationService.push('/');

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
  editCloudGroupIcon: byTestId('edit-group'),

  newRuleButton: byRole('link', { name: 'New alert rule' }),

  editGroupModal: {
    namespaceInput: byRole('textbox', { hidden: true, name: /namespace/i }),
    ruleGroupInput: byRole('textbox', { name: 'Evaluation group', exact: true }),
    intervalInput: byRole('textbox', {
      name: /Rule group evaluation interval Evaluation interval should be smaller or equal to 'For' values for existing rules in this group./i,
    }),
    saveButton: byRole('button', { name: /Save changes/ }),
  },
};

describe('RuleList', () => {
  beforeEach(() => {
    contextSrv.isEditor = true;
    mocks.rulesInSameGroupHaveInvalidForMock.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(undefined as any);
  });

  it('load & show rule groups from multiple cloud data sources', async () => {
    disableRBAC();
    mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));

    setDataSourceSrv(new MockDataSourceSrv(dataSources));

    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Prometheus,
      features: {
        rulerApiEnabled: true,
      },
    });

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

    mocks.api.fetchRulerRules.mockRejectedValue({ status: 500, data: { message: 'Server error' } });

    await renderRuleList();

    await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(4));
    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(5);

    expect(groups[0]).toHaveTextContent('foofolder');
    expect(groups[1]).toHaveTextContent('default group-1');
    expect(groups[2]).toHaveTextContent('default group-1');
    expect(groups[3]).toHaveTextContent('default group-2');
    expect(groups[4]).toHaveTextContent('lokins group-1');

    const errors = await ui.cloudRulesSourceErrors.find();

    expect(errors).not.toHaveTextContent(
      'Failed to load rules state from Prometheus-broken: this datasource is broken'
    );
    await userEvent.click(ui.moreErrorsButton.get());
    expect(errors).toHaveTextContent('Failed to load rules state from Prometheus-broken: this datasource is broken');
  });

  it('expand rule group, rule and alert details', async () => {
    mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);

    setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));
    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

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
    await userEvent.click(ui.groupCollapseToggle.get(groups[1]));
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
    await userEvent.click(ui.ruleCollapseToggle.get(ruleRows[1]));

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

    expect(instanceRows![0]).toHaveTextContent('Firingfoo=barseverity=warning2021-03-18 08:47:05');
    expect(instanceRows![1]).toHaveTextContent('Firingfoo=bazseverity=error2021-03-18 08:47:05');

    // expand details of an instance
    await userEvent.click(ui.ruleCollapseToggle.get(instanceRows![0]));

    const alertDetails = byTestId('expanded-content').get(instanceRows[0]);
    expect(alertDetails).toHaveTextContent('Value2e+10');
    expect(alertDetails).toHaveTextContent('messagefirst alert message');

    // collapse everything again
    await userEvent.click(ui.ruleCollapseToggle.get(instanceRows![0]));
    expect(byTestId('expanded-content').query(instanceRows[0])).not.toBeInTheDocument();
    await userEvent.click(ui.ruleCollapseToggle.getAll(ruleRows[1])[0]);
    await userEvent.click(ui.groupCollapseToggle.get(groups[1]));
    expect(ui.rulesTable.query()).not.toBeInTheDocument();
  });

  it('filters rules and alerts by labels', async () => {
    mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
    setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));

    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

    mocks.api.fetchRulerRules.mockResolvedValue({});
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
    await userEvent.type(filterInput, '{{foo="bar"}');

    // Input is debounced so wait for it to be visible
    await waitFor(() => expect(filterInput).toHaveValue('{foo="bar"}'));
    // Group doesn't contain matching labels
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(1));

    await userEvent.click(ui.groupCollapseToggle.get(groups[0]));

    const ruleRows = ui.ruleRow.getAll(groups[0]);
    expect(ruleRows).toHaveLength(1);

    await userEvent.click(ui.ruleCollapseToggle.get(ruleRows[0]));
    const ruleDetails = ui.expandedContent.get(ruleRows[0]);

    expect(ruleDetails).toHaveTextContent('Labelsseverity=warningfoo=bar');

    // Check for different label matchers
    await userEvent.clear(filterInput);
    await userEvent.type(filterInput, '{{foo!="bar",foo!="baz"}');
    // Group doesn't contain matching labels
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(1));
    await waitFor(() => expect(ui.ruleGroup.get()).toHaveTextContent('group-2'));

    await userEvent.clear(filterInput);
    await userEvent.type(filterInput, '{{foo=~"b.+"}');
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(2));

    await userEvent.clear(filterInput);
    await userEvent.type(filterInput, '{{region="US"}');
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(1));
    await waitFor(() => expect(ui.ruleGroup.get()).toHaveTextContent('group-2'));
  });

  describe('edit lotex groups, namespaces', () => {
    const testDatasources = {
      prom: dataSources.prom,
    };

    function testCase(name: string, fn: () => Promise<void>) {
      it(name, async () => {
        mocks.getAllDataSourcesMock.mockReturnValue(Object.values(testDatasources));
        setDataSourceSrv(new MockDataSourceSrv(testDatasources));

        mocks.api.discoverFeatures.mockResolvedValue({
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: true,
          },
        });

        mocks.api.fetchRules.mockImplementation((sourceName) =>
          Promise.resolve(sourceName === testDatasources.prom.name ? somePromRules() : [])
        );
        mocks.api.fetchRulerRules.mockImplementation(({ dataSourceName }) =>
          Promise.resolve(dataSourceName === testDatasources.prom.name ? someRulerRules : {})
        );
        mocks.api.setRulerRuleGroup.mockResolvedValue();
        mocks.api.deleteNamespace.mockResolvedValue();

        await renderRuleList();

        expect(await ui.rulesFilterInput.find()).toHaveValue('');

        const groups = await ui.ruleGroup.findAll();
        expect(groups).toHaveLength(3);

        // open edit dialog
        await userEvent.click(ui.editCloudGroupIcon.get(groups[0]));
        await expect(screen.getByRole('textbox', { hidden: true, name: /namespace/i })).toHaveDisplayValue(
          'namespace1'
        );
        await expect(screen.getByRole('textbox', { name: 'Evaluation group', exact: true })).toHaveDisplayValue(
          'group1'
        );
        await fn();
      });
    }

    testCase('rename both lotex namespace and group', async () => {
      // make changes to form
      await userEvent.clear(ui.editGroupModal.namespaceInput.get());
      await userEvent.type(ui.editGroupModal.namespaceInput.get(), 'super namespace');

      await userEvent.clear(ui.editGroupModal.ruleGroupInput.get());
      await userEvent.type(ui.editGroupModal.ruleGroupInput.get(), 'super group');

      await userEvent.type(ui.editGroupModal.intervalInput.get(), '5m');

      // submit, check that appropriate calls were made
      await userEvent.click(ui.editGroupModal.saveButton.get());

      await waitFor(() => expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument());

      expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledTimes(2);
      expect(mocks.api.deleteNamespace).toHaveBeenCalledTimes(1);
      expect(mocks.api.deleteGroup).not.toHaveBeenCalled();
      expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
      expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(
        1,
        { dataSourceName: testDatasources.prom.name, apiVersion: 'legacy' },
        'super namespace',
        {
          ...someRulerRules['namespace1'][0],
          name: 'super group',
          interval: '5m',
        }
      );
      expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(
        2,
        { dataSourceName: testDatasources.prom.name, apiVersion: 'legacy' },
        'super namespace',
        someRulerRules['namespace1'][1]
      );
      expect(mocks.api.deleteNamespace).toHaveBeenLastCalledWith(
        { dataSourceName: testDatasources.prom.name, apiVersion: 'legacy' },
        'namespace1'
      );
    });

    testCase('rename just the lotex group', async () => {
      // make changes to form
      await userEvent.clear(screen.getByRole('textbox', { name: 'Evaluation group', exact: true }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Evaluation group', exact: true }), 'super group');
      await userEvent.type(
        screen.getByRole('textbox', {
          name: /rule group evaluation interval evaluation interval should be smaller or equal to 'for' values for existing rules in this group\./i,
        }),
        '5m'
      );

      // submit, check that appropriate calls were made
      await userEvent.click(ui.editGroupModal.saveButton.get());

      await waitFor(() => expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument());

      expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledTimes(1);
      expect(mocks.api.deleteGroup).toHaveBeenCalledTimes(1);
      expect(mocks.api.deleteNamespace).not.toHaveBeenCalled();
      expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
      expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(
        1,
        { dataSourceName: testDatasources.prom.name, apiVersion: 'legacy' },
        'namespace1',
        {
          ...someRulerRules['namespace1'][0],
          name: 'super group',
          interval: '5m',
        }
      );
      expect(mocks.api.deleteGroup).toHaveBeenLastCalledWith(
        { dataSourceName: testDatasources.prom.name, apiVersion: 'legacy' },
        'namespace1',
        'group1'
      );
    });

    testCase('edit lotex group eval interval, no renaming', async () => {
      // make changes to form
      await userEvent.type(ui.editGroupModal.intervalInput.get(), '5m');

      // submit, check that appropriate calls were made
      await userEvent.click(ui.editGroupModal.saveButton.get());

      await waitFor(() => expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument());

      expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledTimes(1);
      expect(mocks.api.deleteGroup).not.toHaveBeenCalled();
      expect(mocks.api.deleteNamespace).not.toHaveBeenCalled();
      expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
      expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(
        1,
        { dataSourceName: testDatasources.prom.name, apiVersion: 'legacy' },
        'namespace1',
        {
          ...someRulerRules['namespace1'][0],
          interval: '5m',
        }
      );
    });
  });

  describe('RBAC Enabled', () => {
    describe('Grafana Managed Alerts', () => {
      it('New alert button should be visible when the user has alert rule create and folder read permissions and no rules exists', async () => {
        enableRBAC();

        grantUserPermissions([
          AccessControlAction.FoldersRead,
          AccessControlAction.AlertingRuleCreate,
          AccessControlAction.AlertingRuleRead,
        ]);

        mocks.getAllDataSourcesMock.mockReturnValue([]);
        setDataSourceSrv(new MockDataSourceSrv({}));
        mocks.api.fetchRules.mockResolvedValue([]);
        mocks.api.fetchRulerRules.mockResolvedValue({});

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });

      it('New alert button should be visible when the user has alert rule create and folder read permissions and rules already exists', async () => {
        enableRBAC();

        grantUserPermissions([
          AccessControlAction.FoldersRead,
          AccessControlAction.AlertingRuleCreate,
          AccessControlAction.AlertingRuleRead,
        ]);

        mocks.getAllDataSourcesMock.mockReturnValue([]);
        setDataSourceSrv(new MockDataSourceSrv({}));
        mocks.api.fetchRules.mockResolvedValue(somePromRules('grafana'));
        mocks.api.fetchRulerRules.mockResolvedValue(someRulerRules);

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });
    });

    describe('Cloud Alerts', () => {
      it('New alert button should be visible when the user has the alert rule external write and datasource read permissions and no rules exists', async () => {
        enableRBAC();

        grantUserPermissions([
          // AccessControlAction.AlertingRuleRead,
          AccessControlAction.DataSourcesRead,
          AccessControlAction.AlertingRuleExternalRead,
          AccessControlAction.AlertingRuleExternalWrite,
        ]);

        mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
        setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));
        mocks.api.discoverFeatures.mockResolvedValue({
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: true,
          },
        });

        mocks.api.fetchRules.mockResolvedValue([]);
        mocks.api.fetchRulerRules.mockResolvedValue({});

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });

      it('New alert button should be visible when the user has the alert rule external write and data source read permissions and rules already exists', async () => {
        enableRBAC();

        grantUserPermissions([
          AccessControlAction.DataSourcesRead,
          AccessControlAction.AlertingRuleExternalRead,
          AccessControlAction.AlertingRuleExternalWrite,
        ]);

        mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
        setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));
        mocks.api.discoverFeatures.mockResolvedValue({
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: true,
          },
        });

        mocks.api.fetchRules.mockResolvedValue(somePromRules('Cortex'));
        mocks.api.fetchRulerRules.mockResolvedValue(someRulerRules);

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });
    });
  });

  describe('Analytics', () => {
    it('Sends log info when creating an alert rule from a scratch', async () => {
      enableRBAC();

      grantUserPermissions([
        AccessControlAction.FoldersRead,
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingRuleRead,
      ]);

      mocks.getAllDataSourcesMock.mockReturnValue([]);
      setDataSourceSrv(new MockDataSourceSrv({}));
      mocks.api.fetchRules.mockResolvedValue([]);
      mocks.api.fetchRulerRules.mockResolvedValue({});

      renderRuleList();

      await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));

      const button = screen.getByText('New alert rule');

      button.addEventListener('click', (event) => event.preventDefault(), false);

      expect(button).toBeEnabled();

      await userEvent.click(button);

      expect(logInfo).toHaveBeenCalledWith(LogMessages.alertRuleFromScratch);
    });
  });
});
