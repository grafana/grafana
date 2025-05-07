import { SerializedError } from '@reduxjs/toolkit';
import { TestProvider } from 'test/helpers/TestProvider';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { PluginExtensionTypes } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, setAppEvents, usePluginLinks } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setAlertmanagerChoices } from 'app/features/alerting/unified/mocks/server/configure';
import * as actions from 'app/features/alerting/unified/state/actions';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { PromAlertingRuleState, PromApplication } from 'app/types/unified-alerting-dto';

import RuleList from './RuleList';
import { discoverFeaturesByUid } from './api/buildInfo';
import { fetchRules } from './api/prometheus';
import * as apiRuler from './api/ruler';
import { fetchRulerRules } from './api/ruler';
import {
  getPotentiallyPausedRulerRules,
  grantUserPermissions,
  mockDataSource,
  mockPromAlert,
  mockPromAlertingRule,
  mockPromRecordingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
  pausedPromRules,
  somePromRules,
  someRulerRules,
} from './mocks';
import { setupPluginsExtensionsHook } from './testSetup/plugins';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn(),
  usePluginLinks: jest.fn(),
  useReturnToPrevious: jest.fn(),
}));
jest.mock('./api/buildInfo');
jest.mock('./api/prometheus');
jest.mock('./api/ruler');

jest.spyOn(actions, 'rulesInSameGroupHaveInvalidFor').mockReturnValue([]);
jest.spyOn(apiRuler, 'rulerUrlBuilder');

setAppEvents(appEvents);
setupPluginsExtensionsHook();

const mocks = {
  usePluginLinksMock: jest.mocked(usePluginLinks),
  rulesInSameGroupHaveInvalidForMock: jest.mocked(actions.rulesInSameGroupHaveInvalidFor),

  api: {
    discoverFeaturesByUid: jest.mocked(discoverFeaturesByUid),
    fetchRules: jest.mocked(fetchRules),
    fetchRulerRules: jest.mocked(fetchRulerRules),
    rulerBuilderMock: jest.mocked(apiRuler.rulerUrlBuilder),
  },
};

const renderRuleList = () => {
  locationService.push('/');

  return render(
    <TestProvider>
      <RuleList />
    </TestProvider>,
    { renderWithRouter: false }
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
  pausedRuleGroup: byText(/groupPaused/),
  cloudRulesSourceErrors: byTestId('cloud-rulessource-errors'),
  groupCollapseToggle: byTestId(selectors.components.AlertRules.groupToggle),
  ruleCollapseToggle: byTestId(selectors.components.AlertRules.toggle),
  rulesTable: byTestId('rules-table'),
  ruleRow: byTestId('row'),
  expandedContent: byTestId(selectors.components.AlertRules.expandedContent),
  rulesFilterInput: byTestId('search-query-input'),
  moreErrorsButton: byRole('button', { name: /more errors/ }),
  editCloudGroupIcon: byTestId('edit-group'),
  newRuleButton: byRole('link', { name: 'New alert rule' }),
  exportButton: byText(/export rules/i),
  editGroupModal: {
    dialog: byRole('dialog'),
    namespaceInput: byRole('textbox', { name: /^Namespace/ }),
    ruleGroupInput: byRole('textbox', { name: /Evaluation group/ }),
    intervalInput: byRole('textbox', {
      name: /Evaluation interval How often is the rule evaluated. Applies to every rule within the group./i,
    }),
    saveButton: byRole('button', { name: /Save/ }),
  },
  stateTags: {
    paused: byText(/^Paused/),
  },
  actionButtons: {
    more: byRole('button', { name: /More/ }),
  },
  moreActionItems: {
    resume: byRole('menuitem', { name: /resume evaluation/i }),
  },
};

setupMswServer();

describe('RuleList', () => {
  beforeEach(() => {
    setAlertmanagerChoices(AlertmanagerChoice.All, 1);
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);
    mocks.rulesInSameGroupHaveInvalidForMock.mockReturnValue([]);
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
    setupDataSources(...Object.values(dataSources));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('load & show rule groups from multiple cloud data sources', async () => {
    mocks.api.discoverFeaturesByUid.mockResolvedValue({
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

    const { user } = await renderRuleList();

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
    await user.click(ui.moreErrorsButton.get());
    expect(errors).toHaveTextContent('Failed to load rules state from Prometheus-broken: this datasource is broken');
  });

  it('expand rule group, rule and alert details', async () => {
    mocks.api.discoverFeaturesByUid.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

    mocks.api.fetchRules.mockImplementation((dataSourceName: string) => {
      if (dataSourceName !== dataSources.prom.name) {
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

    const { user } = await renderRuleList();

    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(2);

    await waitFor(() => expect(groups[0]).toHaveTextContent(/firing|pending|normal/));
    await waitFor(() => expect(groups[1]).toHaveTextContent(/firing|pending|normal/));

    expect(groups[0]).toHaveTextContent('1 firing');
    expect(groups[1]).toHaveTextContent('1 firing');
    expect(groups[1]).toHaveTextContent('1 pending');
    expect(groups[1]).toHaveTextContent('1 recording');
    expect(groups[1]).toHaveTextContent('1 normal');

    // expand second group to see rules table
    expect(ui.rulesTable.query()).not.toBeInTheDocument();
    await user.click(ui.groupCollapseToggle.get(groups[1]));
    const table = await ui.rulesTable.find(groups[1]);

    // check that rule rows are rendered properly
    const ruleRows = ui.ruleRow.getAll(table);
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
    await user.click(ui.ruleCollapseToggle.get(ruleRows[1]));

    const ruleDetails = ui.expandedContent.get(ruleRows[1]);
    const labels = byTestId('label-value').getAll(ruleDetails);
    expect(labels[0]).toHaveTextContent('severitywarning');
    expect(labels[1]).toHaveTextContent('foobar');

    expect(ruleDetails).toHaveTextContent('Expressiontopk ( 5 , foo ) [ 5m ]');
    expect(ruleDetails).toHaveTextContent('messagegreat alert');
    expect(ruleDetails).toHaveTextContent('Instances');

    // finally, check instances table
    const instancesTable = byTestId('dynamic-table').get(ruleDetails);
    expect(instancesTable).toBeInTheDocument();
    const instanceRows = byTestId('row').getAll(instancesTable);
    expect(instanceRows).toHaveLength(2);

    expect(instanceRows![0]).toHaveTextContent('Firingfoobarseveritywarning2021-03-18 08:47:05');
    expect(instanceRows![1]).toHaveTextContent('Firingfoobazseverityerror2021-03-18 08:47:05');

    // expand details of an instance
    await user.click(ui.ruleCollapseToggle.get(instanceRows![0]));

    const alertDetails = byTestId(selectors.components.AlertRules.expandedContent).get(instanceRows[0]);
    expect(alertDetails).toHaveTextContent('Value2e+10');
    expect(alertDetails).toHaveTextContent('messagefirst alert message');

    // collapse everything again
    await user.click(ui.ruleCollapseToggle.get(instanceRows![0]));
    expect(byTestId(selectors.components.AlertRules.expandedContent).query(instanceRows[0])).not.toBeInTheDocument();
    await user.click(ui.ruleCollapseToggle.getAll(ruleRows[1])[0]);
    await user.click(ui.groupCollapseToggle.get(groups[1]));
    expect(ui.rulesTable.query()).not.toBeInTheDocument();
  });

  it('filters rules and alerts by labels', async () => {
    mocks.api.discoverFeaturesByUid.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

    mocks.api.fetchRulerRules.mockResolvedValue({});
    mocks.api.fetchRules.mockImplementation((dataSourceName: string) => {
      if (dataSourceName !== dataSources.prom.name) {
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

    const { user } = await renderRuleList();

    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(2);

    const filterInput = ui.rulesFilterInput.get();
    await user.type(filterInput, 'label:foo=bar{Enter}');

    // Input is debounced so wait for it to be visible
    await waitFor(() => expect(filterInput).toHaveValue('label:foo=bar'));
    // Group doesn't contain matching labels
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(1));

    await user.click(ui.groupCollapseToggle.get(groups[0]));

    const ruleRows = ui.ruleRow.getAll(groups[0]);
    expect(ruleRows).toHaveLength(1);

    await user.click(ui.ruleCollapseToggle.get(ruleRows[0]));
    const ruleDetails = ui.expandedContent.get(ruleRows[0]);
    const labels = byTestId('label-value').getAll(ruleDetails);
    expect(labels[0]).toHaveTextContent('severitywarning');
    expect(labels[1]).toHaveTextContent('foobar');

    // Check for different label matchers
    await user.clear(filterInput);
    await user.type(filterInput, 'label:foo!=bar label:foo!=baz{Enter}');
    // Group doesn't contain matching labels
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(1));
    await waitFor(() => expect(ui.ruleGroup.get()).toHaveTextContent('group-2'));

    await user.clear(filterInput);
    await user.type(filterInput, 'label:"foo=~b.+"{Enter}');
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(2));

    await user.clear(filterInput);
    await user.type(filterInput, 'label:region=US{Enter}');
    await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(1));
    await waitFor(() => expect(ui.ruleGroup.get()).toHaveTextContent('group-2'));
  });

  it.skip('uses entire group when reordering after filtering', async () => {
    const { user } = await renderRuleList();

    mocks.api.discoverFeaturesByUid.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

    mocks.api.fetchRulerRules.mockImplementation(() => Promise.resolve(someRulerRules));
    mocks.api.fetchRules.mockImplementation((dataSourceName: string) => {
      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
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
      } else {
        return Promise.resolve([]);
      }
    });

    renderRuleList();

    const [firstReorderButton] = await screen.findAllByLabelText(/reorder/i);

    const filterInput = ui.rulesFilterInput.get();
    await user.type(filterInput, 'alert1a{Enter}');

    await user.click(firstReorderButton);

    const reorderDialog = await screen.findByRole('dialog');

    const alertsInReorder = within(reorderDialog).getAllByTestId('reorder-alert-rule');

    // We've filtered down to one rule, but the reorder dialog should still
    // have everything in the group visible for reordering
    // If this were not the case, rules could be deleted ⚠️
    expect(alertsInReorder).toHaveLength(2);
  });

  describe.skip('pausing rules', () => {
    beforeEach(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleUpdate,
        AccessControlAction.AlertingRuleExternalRead,
        AccessControlAction.AlertingRuleExternalWrite,
      ]);
      mocks.api.fetchRulerRules.mockImplementation(() => Promise.resolve(getPotentiallyPausedRulerRules(true)));
      mocks.api.fetchRules.mockImplementation((sourceName) =>
        Promise.resolve(sourceName === 'grafana' ? pausedPromRules('grafana') : [])
      );
      mocks.api.rulerBuilderMock.mockReturnValue({
        rules: () => ({ path: `api/ruler/${GRAFANA_RULES_SOURCE_NAME}/api/v1/rules` }),
        namespace: () => ({ path: 'ruler' }),
        namespaceGroup: () => ({
          path: `api/ruler/${GRAFANA_RULES_SOURCE_NAME}/api/v1/rules/NAMESPACE_UID/groupPaused`,
        }),
      });
    });

    test('resuming paused alert rule', async () => {
      const { user } = await renderRuleList();

      // Expand the paused rule group so we can assert the rule state
      await user.click(await ui.pausedRuleGroup.find());

      expect(await ui.stateTags.paused.find()).toBeInTheDocument();

      // TODO: Migrate all testing logic to MSW and so we aren't manually tweaking the API response behaviour
      mocks.api.fetchRulerRules.mockImplementationOnce(() => {
        return Promise.resolve(getPotentiallyPausedRulerRules(false));
      });

      await user.click(await ui.actionButtons.more.find());
      await user.click(await ui.moreActionItems.resume.find());

      await waitFor(() => expect(ui.stateTags.paused.query()).not.toBeInTheDocument());
    });
  });

  /**
   * @TODO port these tests to MSW – they rely on mocks a whole lot, and since we're looking to refactor the list view
   * I imagine we'd need to rewrite these anyway.
   *
   * These actions are currently tested in the "useProduceNewRuleGroup" hook(s).
   */
  describe.skip('edit lotex groups, namespaces', () => {
    const testDatasources = {
      prom: dataSources.prom,
    };

    function testCase(name: string, fn: () => Promise<void>) {
      it(name, async () => {
        mocks.api.discoverFeaturesByUid.mockResolvedValue({
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

        const { user } = await renderRuleList();

        expect(await ui.rulesFilterInput.find()).toHaveValue('');

        await waitFor(() => expect(ui.ruleGroup.queryAll()).toHaveLength(3));

        const groups = await ui.ruleGroup.findAll();
        expect(groups).toHaveLength(3);

        // open edit dialog
        await user.click(ui.editCloudGroupIcon.get(groups[0]));

        await waitFor(() => expect(ui.editGroupModal.dialog.get()).toBeInTheDocument());

        expect(ui.editGroupModal.namespaceInput.get()).toHaveDisplayValue('namespace1');
        expect(ui.editGroupModal.ruleGroupInput.get()).toHaveDisplayValue('group1');
        await fn();
      });
    }

    testCase('rename both lotex namespace and group', async () => {
      const { user } = await renderRuleList();

      // make changes to form
      await user.clear(ui.editGroupModal.namespaceInput.get());
      await user.type(ui.editGroupModal.namespaceInput.get(), 'super namespace');

      await user.clear(ui.editGroupModal.ruleGroupInput.get());
      await user.type(ui.editGroupModal.ruleGroupInput.get(), 'super group');

      await user.clear(ui.editGroupModal.intervalInput.get());
      await user.type(ui.editGroupModal.intervalInput.get(), '5m');

      // submit, check that appropriate calls were made
      await user.click(ui.editGroupModal.saveButton.get());

      await waitFor(() => expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument());

      expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
    });

    testCase('rename just the lotex group', async () => {
      const { user } = await renderRuleList();

      // make changes to form
      await user.clear(ui.editGroupModal.ruleGroupInput.get());
      await user.type(ui.editGroupModal.ruleGroupInput.get(), 'super group');

      await user.clear(ui.editGroupModal.intervalInput.get());
      await user.type(ui.editGroupModal.intervalInput.get(), '5m');

      // submit, check that appropriate calls were made
      await user.click(ui.editGroupModal.saveButton.get());

      await waitFor(() => expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument());

      expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
    });

    testCase('edit lotex group eval interval, no renaming', async () => {
      const { user } = await renderRuleList();

      // make changes to form
      await user.clear(ui.editGroupModal.intervalInput.get());
      await user.type(ui.editGroupModal.intervalInput.get(), '5m');

      // submit, check that appropriate calls were made
      await user.click(ui.editGroupModal.saveButton.get());

      await waitFor(() => expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument());

      expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
    });
  });

  describe('RBAC Enabled', () => {
    describe('Export button', () => {
      it('Export button should be visible when the user has alert read permissions', async () => {
        grantUserPermissions([AccessControlAction.AlertingRuleRead]);

        mocks.api.fetchRules.mockResolvedValue([
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
        mocks.api.fetchRulerRules.mockResolvedValue({});

        renderRuleList();

        const groupRows = await ui.ruleGroup.findAll();

        expect(groupRows).toHaveLength(1);
        expect(ui.exportButton.get()).toBeInTheDocument();
      });
    });

    describe('Grafana Managed Alerts', () => {
      it('New alert button should be visible when the user has alert rule create and folder read permissions and no rules exists', async () => {
        grantUserPermissions([
          AccessControlAction.FoldersRead,
          AccessControlAction.AlertingRuleCreate,
          AccessControlAction.AlertingRuleRead,
        ]);

        mocks.api.fetchRules.mockResolvedValue([]);
        mocks.api.fetchRulerRules.mockResolvedValue({});

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));

        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });

      it('New alert button should be visible when the user has alert rule create and folder read permissions and rules already exists', async () => {
        grantUserPermissions([
          AccessControlAction.FoldersRead,
          AccessControlAction.AlertingRuleCreate,
          AccessControlAction.AlertingRuleRead,
        ]);

        mocks.api.fetchRules.mockResolvedValue(somePromRules('grafana'));
        mocks.api.fetchRulerRules.mockResolvedValue(someRulerRules);

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(1));
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });
    });

    describe('Cloud Alerts', () => {
      it('New alert button should be visible when the user has the alert rule external write and datasource read permissions and no rules exists', async () => {
        grantUserPermissions([
          // AccessControlAction.AlertingRuleRead,
          AccessControlAction.DataSourcesRead,
          AccessControlAction.AlertingRuleExternalRead,
          AccessControlAction.AlertingRuleExternalWrite,
        ]);

        mocks.api.discoverFeaturesByUid.mockResolvedValue({
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: true,
          },
        });

        mocks.api.fetchRules.mockResolvedValue([]);
        mocks.api.fetchRulerRules.mockResolvedValue({});

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalled());
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });

      it('New alert button should be visible when the user has the alert rule external write and data source read permissions and rules already exists', async () => {
        grantUserPermissions([
          AccessControlAction.DataSourcesRead,
          AccessControlAction.AlertingRuleExternalRead,
          AccessControlAction.AlertingRuleExternalWrite,
        ]);

        mocks.api.discoverFeaturesByUid.mockResolvedValue({
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: true,
          },
        });

        mocks.api.fetchRules.mockResolvedValue(somePromRules('Cortex'));
        mocks.api.fetchRulerRules.mockResolvedValue(someRulerRules);

        renderRuleList();

        await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalled());
        expect(ui.newRuleButton.get()).toBeInTheDocument();
      });
    });
  });
});
