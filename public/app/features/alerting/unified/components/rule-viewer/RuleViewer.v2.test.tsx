import { render, screen, waitFor } from 'test/test-utils';
import { byLabelText, byRole, byText } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

import {
  __clearRuleViewTabsForTests,
  addEnrichmentSection,
} from '../../enterprise-components/rule-view-page/extensions';
import {
  getCloudRule,
  getGrafanaRule,
  getVanillaPromRule,
  grantUserPermissions,
  mockCombinedCloudRuleNamespace,
  mockDataSource,
  mockPluginLinkExtension,
  mockPromAlertingRule,
} from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { grantPermissionsHelper } from '../../test/test-utils';
import { setupDataSources } from '../../testSetup/datasources';
import { Annotation } from '../../utils/constants';
import { DataSourceType } from '../../utils/datasource';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import * as ruleId from '../../utils/rule-id';
import { stringifyIdentifier } from '../../utils/rule-id';

import { AlertRuleProvider } from './RuleContext';
import { ActiveTab } from './RuleViewer';
import RuleViewerV2 from './RuleViewer.v2';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

const ELEMENTS = {
  loading: byText(/Loading rule/i),
  metadata: {
    summary: (text: string) => byText(text),
    label: ([key, value]: [string, string]) => byRole('listitem', { name: `${key}: ${value}` }),
  },
  details: {
    pendingPeriod: byLabelText(/Pending period/i),
  },
  actions: {
    edit: byRole('link', { name: 'Edit' }),
    more: {
      button: byRole('button', { name: /More/i }),
    },
  },
};

setupMswServer();

setPluginLinksHook(() => ({
  links: [
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
  addEnrichmentSection();
});

afterEach(() => {
  __clearRuleViewTabsForTests();
  addEnrichmentSection();
});

beforeEach(() => {
  grantPermissionsHelper([
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingInstanceCreate,
  ]);
});

const dataSources = {
  am: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'Alertmanager',
      type: DataSourceType.Alertmanager,
      jsonData: { handleGrafanaManagedAlerts: true },
    },
    { module: 'core:plugin/alertmanager' }
  ),
  mimir: mockDataSource({ uid: 'mimir', name: 'Mimir' }, { module: 'core:plugin/prometheus' }),
  prometheus: mockDataSource({ uid: 'prometheus', name: 'Prometheus' }, { module: 'core:plugin/prometheus' }),
};

describe('RuleViewer v2', () => {
  beforeEach(() => {
    setupDataSources(...Object.values(dataSources));
  });

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
      { uid: grafanaRulerRule.grafana_alert.uid }
    );
    const mockRuleIdentifier = ruleId.fromCombinedRule('grafana', mockRule);

    beforeEach(() => {
      grantPermissionsHelper([
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleUpdate,
        AccessControlAction.AlertingRuleDelete,
        AccessControlAction.AlertingInstanceRead,
        AccessControlAction.AlertingInstanceCreate,
        AccessControlAction.AlertingInstanceRead,
        AccessControlAction.AlertingInstancesExternalRead,
        AccessControlAction.AlertingInstancesExternalWrite,
      ]);
    });

    it('should render a Grafana managed alert rule with simplified metadata', async () => {
      await renderRuleViewer(mockRule, mockRuleIdentifier);

      expect(screen.getByText('Test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      const ruleSummary = mockRule.annotations[Annotation.summary];
      const labels = mockRule.labels;

      expect(ELEMENTS.metadata.summary(ruleSummary).get()).toBeInTheDocument();

      // v2 simplified metadata: only labels in header (no dashboard/panel, runbook, or evaluation interval)
      // Evaluation interval appears in the details sidebar instead
      expect(screen.getByText(mockRule.group.interval!)).toBeInTheDocument();

      for (const label in labels) {
        expect(ELEMENTS.metadata.label([label, labels[label]]).get()).toBeInTheDocument();
      }

      // actions
      expect(await ELEMENTS.actions.edit.find()).toBeInTheDocument();
      expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();
    });

    it('should render local tabs inside the grid', async () => {
      await renderRuleViewer(mockRule, mockRuleIdentifier);

      // v2 renders tabs locally inside the grid layout
      expect(screen.getByText('Query and conditions')).toBeInTheDocument();
      expect(screen.getByText('Instances')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    it('should not show any labels if we only have private labels', async () => {
      const ruleIdentifier = ruleId.fromCombinedRule('grafana', mockRule);
      const rule = getGrafanaRule({
        name: 'Test alert',
        labels: {
          [GRAFANA_ORIGIN_LABEL]: 'plugins/synthetic-monitoring-app',
        },
      });

      await renderRuleViewer(rule, ruleIdentifier);
      expect(screen.queryByText('Labels')).not.toBeInTheDocument();
    });
  });

  describe('Data source managed alert rule', () => {
    const { mimir } = dataSources;

    const mockRule = getCloudRule(
      {
        name: 'cloud test alert',
        annotations: { [Annotation.summary]: 'cloud summary', [Annotation.runbookURL]: 'https://runbook.example.com' },
        group: { name: 'Cloud group', interval: '15m', rules: [], totals: { alerting: 1 } },
      },
      { rulesSource: mimir }
    );
    const mockRuleIdentifier = ruleId.fromCombinedRule(mimir.name, mockRule);

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleExternalRead,
        AccessControlAction.AlertingRuleExternalWrite,
      ]);
    });

    it('should render a data source managed alert rule', () => {
      renderRuleViewer(mockRule, mockRuleIdentifier);

      expect(screen.getByText('cloud test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      expect(screen.getAllByText(mockRule.annotations[Annotation.summary])[0]).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: mockRule.annotations[Annotation.runbookURL] })[0]).toBeInTheDocument();
      expect(screen.getByText(mockRule.group.interval!)).toBeInTheDocument();
    });
  });

  describe('Vanilla Prometheus rule', () => {
    const { prometheus } = dataSources;

    const mockRule = getVanillaPromRule({
      name: 'prom test alert',
      namespace: mockCombinedCloudRuleNamespace({ name: 'prometheus' }, prometheus.name),
      annotations: {
        [Annotation.summary]: 'prom summary',
        [Annotation.runbookURL]: 'https://runbook.example.com',
      },
      promRule: {
        ...mockPromAlertingRule({
          annotations: {
            [Annotation.summary]: 'prom summary',
            [Annotation.runbookURL]: 'https://runbook.example.com',
          },
        }),
        duration: 900,
      },
    });

    const mockRuleIdentifier = ruleId.fromCombinedRule(prometheus.name, mockRule);

    it('should render metadata for vanilla Prometheus alert rule', async () => {
      renderRuleViewer(mockRule, mockRuleIdentifier);

      expect(screen.getByText('prom test alert')).toBeInTheDocument();

      // v2 simplified metadata: runbook URL appears only once (in sidebar annotations, not in header)
      expect(ELEMENTS.metadata.summary(mockRule.annotations[Annotation.runbookURL]).getAll()).toHaveLength(1);
      expect(ELEMENTS.metadata.summary(mockRule.annotations[Annotation.summary]).getAll()).toHaveLength(2);

      expect(ELEMENTS.details.pendingPeriod.get()).toHaveTextContent(/15m/i);
    });
  });
});

const renderRuleViewer = async (rule: CombinedRule, identifier: RuleIdentifier, tab: ActiveTab = ActiveTab.Query) => {
  const path = `/alerting/${identifier.ruleSourceName}/${stringifyIdentifier(identifier)}/view?tab=${tab}`;
  const view = render(
    <AlertRuleProvider identifier={identifier} rule={rule}>
      <RuleViewerV2 />
    </AlertRuleProvider>,
    { historyOptions: { initialEntries: [path] } }
  );

  await waitFor(() => expect(ELEMENTS.loading.query()).not.toBeInTheDocument());

  return view;
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));
