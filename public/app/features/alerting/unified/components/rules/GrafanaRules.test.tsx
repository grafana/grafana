import { render, screen, within } from 'test/test-utils';
import { Provider } from 'react-redux';
import { byTestId, byText } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRuleGroup, type CombinedRuleNamespace } from 'app/types/unified-alerting';

import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { useHasRuler } from '../../hooks/useHasRuler';
import { mockFolderApi, setupMswServer } from '../../mockApi';
import {
  grantUserPermissions,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockCombinedRuleNamespace,
  mockFolder,
  mockGrafanaRulerRule,
  mockUnifiedAlertingStore,
} from '../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { NO_GROUP_PREFIX } from '../../utils/rules';

import { GrafanaRules } from './GrafanaRules';

jest.mock('../../hooks/useHasRuler');

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const ui = {
  ruleGroups: byTestId('rule-group'),
  groupHeaders: byTestId('rule-group-header'),
  ruleName: (name: string | RegExp) => byText(name),
};

const server = setupMswServer();

function buildStore() {
  return mockUnifiedAlertingStore({
    promRules: {
      [GRAFANA_RULES_SOURCE_NAME]: { loading: false, dispatched: true, result: [{}] as never },
    },
  });
}

function getGroupByHeader(groups: readonly HTMLElement[], headerText: string): HTMLElement {
  const group = groups.find((g) => within(g).queryByTestId('rule-group-header')?.textContent?.includes(headerText));
  if (!group) {
    throw new Error(`No rendered rule-group found with header text "${headerText}"`);
  }
  return group;
}

function buildNamespaces() {
  const infraGroup = mockCombinedRuleGroup('CPU and Memory', [
    mockCombinedRule({
      name: 'High CPU Usage',
      rulerRule: mockGrafanaRulerRule({ namespace_uid: 'platform-alerts' }),
    }),
  ]);
  const ungroupedDiskAlert: CombinedRuleGroup = {
    ...mockCombinedRuleGroup(`${NO_GROUP_PREFIX}disk-usage-alert`, [
      mockCombinedRule({
        name: 'Disk Usage Above 90%',
        rulerRule: mockGrafanaRulerRule({ namespace_uid: 'platform-alerts' }),
      }),
    ]),
    totals: {},
  };
  const ungroupedLatencyAlert: CombinedRuleGroup = {
    ...mockCombinedRuleGroup(`${NO_GROUP_PREFIX}api-latency-alert`, [
      mockCombinedRule({
        name: 'API Latency P99 Exceeded',
        rulerRule: mockGrafanaRulerRule({ namespace_uid: 'platform-alerts' }),
      }),
    ]),
    totals: {},
  };

  const namespace: CombinedRuleNamespace = mockCombinedRuleNamespace({
    name: 'platform-alerts',
    groups: [infraGroup, ungroupedDiskAlert, ungroupedLatencyAlert],
  });

  return [namespace];
}

describe('GrafanaRules', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    jest.mocked(useHasRuler).mockReturnValue({ hasRuler: true, rulerConfig: GRAFANA_RULER_CONFIG });
    mockFolderApi(server).folder('platform-alerts', mockFolder({ uid: 'platform-alerts', canSave: true }));
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renders real groups alongside merged Ungrouped group in grouped view', async () => {
    const store = buildStore();
    const namespaces = buildNamespaces();

    render(
      <Provider store={store}>
        <GrafanaRules namespaces={namespaces} expandAll={true} />
      </Provider>,
      { historyOptions: { initialEntries: ['/alerting/list'] } }
    );

    const groups = await ui.ruleGroups.findAll();
    expect(groups).toHaveLength(2);

    const infraGroup = getGroupByHeader(groups, 'CPU and Memory');
    const ungroupedGroup = getGroupByHeader(groups, 'Ungrouped');

    // High CPU Usage belongs to the real group; disk and latency alerts are in the virtual Ungrouped group
    expect(within(infraGroup).getByText('High CPU Usage')).toBeInTheDocument();
    expect(within(ungroupedGroup).getByText('Disk Usage Above 90%')).toBeInTheDocument();
    expect(within(ungroupedGroup).getByText('API Latency P99 Exceeded')).toBeInTheDocument();

    // No raw NO_GROUP_PREFIX text leaks into the UI
    expect(screen.queryByText(new RegExp(NO_GROUP_PREFIX))).not.toBeInTheDocument();
  });

  it('flattens ungrouped rules in list view without an Ungrouped group header', async () => {
    const store = buildStore();
    const namespaces = buildNamespaces();

    render(
      <Provider store={store}>
        <GrafanaRules namespaces={namespaces} expandAll={true} />
      </Provider>,
      { historyOptions: { initialEntries: ['/alerting/list?view=list'] } }
    );

    // All rules are still present after flattening
    expect(await ui.ruleName('High CPU Usage').find()).toBeInTheDocument();
    expect(await ui.ruleName('Disk Usage Above 90%').find()).toBeInTheDocument();
    expect(await ui.ruleName('API Latency P99 Exceeded').find()).toBeInTheDocument();

    // No Ungrouped group header — list view flattens rules into the default group
    const headers = await ui.groupHeaders.findAll();
    expect(headers.some((h) => h.textContent?.includes('Ungrouped'))).toBe(false);
  });
});
