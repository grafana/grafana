import React from 'react';
import { render, waitFor, screen, userEvent } from 'test/test-utils';
import { byText, byRole } from 'testing-library-selector';

import { setBackendSrv, setDataSourceSrv, setPluginExtensionsHook } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setFolderAccessControl } from 'app/features/alerting/unified/mocks/server/configure';
import { MOCK_GRAFANA_ALERT_RULE_TITLE } from 'app/features/alerting/unified/mocks/server/handlers/alertRules';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

import {
  MockDataSourceSrv,
  getCloudRule,
  getGrafanaRule,
  grantUserPermissions,
  mockDataSource,
  mockPluginLinkExtension,
} from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { Annotation } from '../../utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import * as ruleId from '../../utils/rule-id';

import { AlertRuleProvider } from './RuleContext';
import RuleViewer from './RuleViewer';

// metadata and interactive elements
const ELEMENTS = {
  loading: byText(/Loading rule/i),
  metadata: {
    summary: (text: string) => byText(text),
    runbook: (url: string) => byRole('link', { name: url }),
    dashboardAndPanel: byRole('link', { name: 'View panel' }),
    evaluationInterval: (interval: string) => byText(`Every ${interval}`),
    label: ([key, value]: [string, string]) => byRole('listitem', { name: `${key}: ${value}` }),
  },
  actions: {
    edit: byRole('link', { name: 'Edit' }),
    more: {
      button: byRole('button', { name: /More/i }),
      actions: {
        silence: byRole('menuitem', { name: /Silence/i }),
        duplicate: byRole('menuitem', { name: /Duplicate/i }),
        copyLink: byRole('menuitem', { name: /Copy link/i }),
        export: byRole('menuitem', { name: /Export/i }),
        delete: byRole('menuitem', { name: /Delete/i }),
      },
      pluginActions: {
        sloDashboard: byRole('menuitem', { name: /SLO dashboard/i }),
        declareIncident: byRole('link', { name: /Declare incident/i }),
        assertsWorkbench: byRole('menuitem', { name: /Open workbench/i }),
      },
    },
  },
};

setupMswServer();
setupDataSources(mockDataSource({ type: DataSourceType.Prometheus, name: 'mimir-1' }));
setPluginExtensionsHook(() => ({
  extensions: [
    mockPluginLinkExtension({ pluginId: 'grafana-slo-app', title: 'SLO dashboard', path: '/a/grafana-slo-app' }),
    mockPluginLinkExtension({
      pluginId: 'grafana-asserts-app',
      title: 'Open workbench',
      path: '/a/grafana-asserts-app',
    }),
  ],
  isLoading: false,
}));

beforeAll(() => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingInstanceCreate,
  ]);
  setBackendSrv(backendSrv);
});

describe('RuleViewer', () => {
  describe('Grafana managed alert rule', () => {
    const mockRule = getGrafanaRule(
      {
        name: 'Test alert',
        annotations: {
          [Annotation.dashboardUID]: 'dashboard-1',
          [Annotation.panelID]: 'panel-1',
          [Annotation.summary]: 'This is the summary for the rule',
          [Annotation.runbookURL]: 'https://runbook.site/',
        },
        labels: {
          team: 'operations',
          severity: 'low',
        },
        group: {
          name: 'my-group',
          interval: '15m',
          rules: [],
          totals: { alerting: 1 },
        },
      },
      { uid: 'test1' }
    );
    const mockRuleIdentifier = ruleId.fromCombinedRule('grafana', mockRule);

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleUpdate,
        AccessControlAction.AlertingRuleDelete,
        AccessControlAction.AlertingInstanceCreate,
      ]);
      setBackendSrv(backendSrv);

      setFolderAccessControl({
        [AccessControlAction.AlertingRuleCreate]: true,
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleUpdate]: true,
        [AccessControlAction.AlertingRuleDelete]: true,
        [AccessControlAction.AlertingInstanceCreate]: true,
      });
    });

    it('should render a Grafana managed alert rule', async () => {
      await renderRuleViewer(mockRule, mockRuleIdentifier);

      // assert on basic info to be visible
      expect(screen.getByText('Test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      // alert rule metadata
      const ruleSummary = mockRule.annotations[Annotation.summary];
      const runBookURL = mockRule.annotations[Annotation.runbookURL];
      const groupInterval = mockRule.group.interval;
      const labels = mockRule.labels;

      expect(ELEMENTS.metadata.summary(ruleSummary).get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.dashboardAndPanel.get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.runbook(runBookURL).get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.evaluationInterval(groupInterval!).get()).toBeInTheDocument();

      for (const label in labels) {
        expect(ELEMENTS.metadata.label([label, labels[label]]).get()).toBeInTheDocument();
      }

      // actions
      await waitFor(() => {
        expect(ELEMENTS.actions.edit.get()).toBeInTheDocument();
        expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();
      });

      // check the "more actions" button
      await userEvent.click(ELEMENTS.actions.more.button.get());
      const menuItems = Object.values(ELEMENTS.actions.more.actions);
      for (const menuItem of menuItems) {
        expect(menuItem.get()).toBeInTheDocument();
      }
    });

    it('renders silencing form correctly and shows alert rule name', async () => {
      const dataSources = {
        grafana: mockDataSource<AlertManagerDataSourceJsonData>({
          name: GRAFANA_RULES_SOURCE_NAME,
          type: DataSourceType.Alertmanager,
          jsonData: {
            handleGrafanaManagedAlerts: true,
          },
        }),
        am: mockDataSource<AlertManagerDataSourceJsonData>({
          name: 'Alertmanager',
          type: DataSourceType.Alertmanager,
          jsonData: {
            handleGrafanaManagedAlerts: true,
          },
        }),
      };
      setupDataSources(dataSources.grafana, dataSources.am);
      setDataSourceSrv(new MockDataSourceSrv(dataSources));

      await renderRuleViewer(mockRule, mockRuleIdentifier);

      const user = userEvent.setup();
      await user.click(ELEMENTS.actions.more.button.get());
      await user.click(ELEMENTS.actions.more.actions.silence.get());

      expect(await screen.findByLabelText(/^alert rule/i)).toHaveValue(MOCK_GRAFANA_ALERT_RULE_TITLE);
    });
  });

  describe('Data source managed alert rule', () => {
    const mockRule = getCloudRule({
      name: 'cloud test alert',
      annotations: { [Annotation.summary]: 'cloud summary', [Annotation.runbookURL]: 'https://runbook.example.com' },
      group: { name: 'Cloud group', interval: '15m', rules: [], totals: { alerting: 1 } },
    });
    const mockRuleIdentifier = ruleId.fromCombinedRule('mimir-1', mockRule);

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleExternalRead,
        AccessControlAction.AlertingRuleExternalWrite,
      ]);
    });

    it('should render a data source managed alert rule', () => {
      renderRuleViewer(mockRule, mockRuleIdentifier);

      // assert on basic info to be vissible
      expect(screen.getByText('cloud test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      expect(screen.getByText(mockRule.annotations[Annotation.summary])).toBeInTheDocument();
      expect(screen.getByRole('link', { name: mockRule.annotations[Annotation.runbookURL] })).toBeInTheDocument();
      expect(screen.getByText(`Every ${mockRule.group.interval}`)).toBeInTheDocument();
    });

    it('should render custom plugin actions for a plugin-provided rule', async () => {
      const sloRule = getCloudRule({
        name: 'slo test alert',
        labels: { __grafana_origin: 'plugin/grafana-slo-app' },
      });
      const sloRuleIdentifier = ruleId.fromCombinedRule('mimir-1', sloRule);

      const user = userEvent.setup();

      renderRuleViewer(sloRule, sloRuleIdentifier);

      expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();

      await user.click(ELEMENTS.actions.more.button.get());

      expect(ELEMENTS.actions.more.pluginActions.sloDashboard.get()).toBeInTheDocument();
      expect(ELEMENTS.actions.more.pluginActions.assertsWorkbench.query()).not.toBeInTheDocument();

      await waitFor(() => expect(ELEMENTS.actions.more.pluginActions.declareIncident.get()).toBeEnabled());
    });

    it('should render different custom plugin actions for a different plugin-provided rule', async () => {
      const assertsRule = getCloudRule({
        name: 'asserts test alert',
        labels: { __grafana_origin: 'plugin/grafana-asserts-app' },
      });
      const assertsRuleIdentifier = ruleId.fromCombinedRule('mimir-1', assertsRule);

      renderRuleViewer(assertsRule, assertsRuleIdentifier);

      expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();

      await userEvent.click(ELEMENTS.actions.more.button.get());

      expect(ELEMENTS.actions.more.pluginActions.assertsWorkbench.get()).toBeInTheDocument();
      expect(ELEMENTS.actions.more.pluginActions.sloDashboard.query()).not.toBeInTheDocument();

      await waitFor(() => expect(ELEMENTS.actions.more.pluginActions.declareIncident.get()).toBeEnabled());
    });
  });
});

const renderRuleViewer = async (rule: CombinedRule, identifier: RuleIdentifier) => {
  render(
    <AlertRuleProvider identifier={identifier} rule={rule}>
      <RuleViewer />
    </AlertRuleProvider>
  );

  await waitFor(() => expect(ELEMENTS.loading.query()).not.toBeInTheDocument());
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));
