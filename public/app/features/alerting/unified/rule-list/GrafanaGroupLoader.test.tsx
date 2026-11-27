import { act, render, waitFor } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { useAssistant } from '@grafana/assistant';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import {
  type GrafanaPromRuleDTO,
  type GrafanaPromRuleGroupDTO,
  PromAlertingRuleState,
  PromRuleType,
  type RulerGrafanaRuleDTO,
  type RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../api/prometheusApi';
import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { grafanaRulerGroup, grafanaRulerNamespace } from '../mocks/grafanaRulerApi';
import { setFolderAccessControl, setGrafanaPromRules } from '../mocks/server/configure';
import { RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { prometheusRuleType, rulerRuleType } from '../utils/rules';
import { intervalToSeconds } from '../utils/time';

import { GrafanaGroupLoader } from './GrafanaGroupLoader';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, data) => ({ type, ...data })),
}));
const mockUseAssistant = jest.mocked(useAssistant);

jest.mock('./components/RuleActionsButtons.V2', () => {
  const actual = jest.requireActual('./components/RuleActionsButtons.V2');
  return { ...actual, RuleActionsButtons: jest.fn(actual.RuleActionsButtons) };
});
const mockRuleActionsButtons = jest.mocked(RuleActionsButtons);

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

const ui = {
  ruleItems: () => byRole('treeitem'),
  ruleItem: (ruleName: string) => byRole('treeitem', { name: ruleName }),
  ruleStatus: (status: string) => byLabelText(status),
  ruleLink: (ruleName: string) => byRole('link', { name: ruleName }),
  editButton: () => byRole('link', { name: 'Edit' }),
  moreButton: () => byRole('button', { name: 'More' }),
  // Menu items that appear when More button is clicked
  menuItems: {
    silence: () => byRole('menuitem', { name: /silence/i }),
    duplicate: () => byRole('menuitem', { name: /duplicate/i }),
    copyLink: () => byRole('menuitem', { name: /copy link/i }),
    export: () => byRole('menuitem', { name: /export/i }),
    delete: () => byRole('menuitem', { name: /delete/i }),
    pause: () => byRole('menuitem', { name: /pause/i }),
    analyzeRule: () => byRole('menuitem', { name: /analyze rule/i }),
  },
};

describe('GrafanaGroupLoader', () => {
  beforeEach(() => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    grantUserPermissions([
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingSilenceCreate,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingRuleRead,
    ]);
    // Grant necessary permissions for editing rules
    setFolderAccessControl({
      [AccessControlAction.AlertingRuleUpdate]: true,
      [AccessControlAction.AlertingRuleDelete]: true,
      [AccessControlAction.AlertingSilenceCreate]: true,
      [AccessControlAction.AlertingRuleCreate]: true, // For duplicate action
      [AccessControlAction.AlertingRuleRead]: true, // For export action
    });
  });

  it('should render rule with url when ruler and prom rule exist', async () => {
    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    const ruleStatus = ui.ruleStatus('Normal').get(ruleListItem);
    expect(ruleStatus).toBeInTheDocument();

    const ruleLink = ui.ruleLink(rule1.grafana_alert.title).get(ruleListItem);
    expect(ruleLink).toHaveAttribute(
      'href',
      expect.stringContaining(`/alerting/grafana/${rule1.grafana_alert.uid}/view`)
    );
  });

  it('should render More button with action menu options', async () => {
    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    // Check that More button is present
    const moreButton = ui.moreButton().get(ruleListItem);
    expect(moreButton).toBeInTheDocument();

    // Verify More button accessibility
    expect(moreButton).toHaveAttribute('aria-label', 'More');
    expect(moreButton).toHaveTextContent('More');
  });

  it('should render multiple rules with their own action buttons', async () => {
    // Create a group with multiple rules
    const multiRuleGroup = {
      ...grafanaRulerGroup,
      rules: [
        grafanaRulerGroup.rules[0],
        {
          ...grafanaRulerGroup.rules[0],
          grafana_alert: {
            ...grafanaRulerGroup.rules[0].grafana_alert,
            uid: 'second-rule-uid',
            title: 'Second Rule',
          },
        },
      ],
    };

    setGrafanaPromRules([rulerGroupToPromGroup(multiRuleGroup)]);

    const groupIdentifier = getGroupIdentifier(multiRuleGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    // Check first rule
    const [rule1, rule2] = multiRuleGroup.rules;
    const ruleListItem1 = await ui.ruleItem(rule1.grafana_alert.title).find();
    const ruleListItem2 = await ui.ruleItem(rule2.grafana_alert.title).find();

    // Each rule should have its own More button
    expect(ui.moreButton().get(ruleListItem1)).toBeInTheDocument();
    expect(ui.moreButton().get(ruleListItem2)).toBeInTheDocument();

    // Check that edit buttons are present and have correct URLs
    const editButton1 = ui.editButton().get(ruleListItem1);
    const editButton2 = ui.editButton().get(ruleListItem2);

    expect(editButton1).toBeInTheDocument();
    expect(editButton2).toBeInTheDocument();

    // Check that edit buttons have correct URLs (the actual format is simpler)
    expect(editButton1).toHaveAttribute('href', expect.stringContaining(`/alerting/${rule1.grafana_alert.uid}/edit`));
    expect(editButton2).toHaveAttribute('href', expect.stringContaining(`/alerting/${rule2.grafana_alert.uid}/edit`));
  });

  it('should not render edit button when user lacks edit permissions', async () => {
    // Override permissions to deny editing
    setFolderAccessControl({
      [AccessControlAction.AlertingRuleUpdate]: false,
      [AccessControlAction.AlertingRuleDelete]: false,
    });

    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    // Edit button should not be present
    expect(ui.editButton().query(ruleListItem)).not.toBeInTheDocument();

    // More button should still be present (for other actions like viewing)
    expect(ui.moreButton().get(ruleListItem)).toBeInTheDocument();
  });

  it('should render correct menu actions when More button is clicked', async () => {
    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    const { user } = render(
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />
    );

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    // Find and click the More button
    const moreButton = ui.moreButton().get(ruleListItem);
    await user.click(moreButton);

    // Check that the dropdown menu appears
    const menu = byRole('menu').get();
    expect(menu).toBeInTheDocument();

    // With proper permissions, all 6 menu actions should be available:

    // 1. Silence notifications - available for alerting rules (AlertingSilenceCreate permission)
    expect(ui.menuItems.silence().get()).toBeInTheDocument();

    // 2. Copy link - always available
    expect(ui.menuItems.copyLink().get()).toBeInTheDocument();

    // 3. Duplicate - should be available with create permissions (AlertingRuleCreate permission)
    expect(ui.menuItems.duplicate().get()).toBeInTheDocument();

    // 4. Export - should be available for Grafana alerting rules (AlertingRuleRead permission)
    expect(ui.menuItems.export().get()).toBeInTheDocument();

    // 5. Delete - should be available for Grafana alerting rules (AlertingRuleDelete permission)
    expect(ui.menuItems.delete().get()).toBeInTheDocument();

    // 6. Pause - should be available for Grafana alerting rules (AlertingRuleUpdate permission)
    expect(ui.menuItems.pause().get()).toBeInTheDocument();

    // Verify that the menu contains all 6 expected menu items
    const menuItems = byRole('menuitem').getAll();
    expect(menuItems.length).toBe(6);
  });

  it('should render Analyze rule menu item when assistant is available', async () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    const { user } = render(
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />
    );

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    // Click the More button to open the menu
    const moreButton = ui.moreButton().get(ruleListItem);
    await user.click(moreButton);

    // Check that Analyze rule menu item is present
    expect(ui.menuItems.analyzeRule().get()).toBeInTheDocument();

    // With assistant enabled, there should be 7 menu items (6 + Analyze rule)
    const menuItems = byRole('menuitem').getAll();
    expect(menuItems.length).toBe(7);
  });

  it('should not render Analyze rule menu item when assistant is not available', async () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    const { user } = render(
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />
    );

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    // Click the More button to open the menu
    const moreButton = ui.moreButton().get(ruleListItem);
    await user.click(moreButton);

    // Check that Analyze rule menu item is NOT present
    expect(ui.menuItems.analyzeRule().query()).not.toBeInTheDocument();

    // Without assistant, there should be 6 menu items
    const menuItems = byRole('menuitem').getAll();
    expect(menuItems.length).toBe(6);
  });

  describe('rule row re-renders', () => {
    // All rules have to fit on one page (DEFAULT_PER_PAGE_PAGINATION_RULES_PER_GROUP), or the rows never all render
    const RULES_COUNT = 100;
    const FIRST_EVALUATION = { lastEvaluation: '2026-11-24T10:00:00Z', evaluationTime: 0.01 };
    const NEXT_EVALUATION = { lastEvaluation: '2026-11-24T10:01:00Z', evaluationTime: 0.02 };

    const actualRuleActionsButtons = jest.requireActual('./components/RuleActionsButtons.V2').RuleActionsButtons;

    beforeEach(() => {
      mockRuleActionsButtons.mockClear();
      // The real actions re-render themselves as their ability queries resolve (4 calls per row on mount instead of 1),
      // which would hide whether the row re-rendered them
      mockRuleActionsButtons.mockImplementation(() => null);
    });

    afterEach(() => {
      jest.useRealTimers();
      mockRuleActionsButtons.mockImplementation(actualRuleActionsButtons);
    });

    // Waits on the count: the loading skeletons are treeitems too, so existence alone resolves too early
    const waitForRows = (count: number) => waitFor(() => expect(ui.ruleItems().getAll()).toHaveLength(count));

    const setUpLargeGroup = () => {
      const group = buildRulerGroup(RULES_COUNT);
      const promGroup = evaluatedAt(rulerGroupToPromGroup(group), FIRST_EVALUATION);
      setGrafanaPromRules([promGroup]);
      const groupIdentifier = getGroupIdentifier(group);
      // A new element on every call: React skips re-rendering when handed the same element instance
      const loader = (namespaceName = grafanaRulerNamespace.name) => (
        <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={namespaceName} />
      );
      return { groupIdentifier, promGroup, loader };
    };

    // Fake timers are installed before render: RTK Query schedules the polling timer when the component subscribes
    const renderLargeGroupWithFakeTimers = async () => {
      jest.useFakeTimers({ advanceTimers: true });
      const { groupIdentifier, promGroup, loader } = setUpLargeGroup();
      const store = configureStore();
      render(loader(), { store });
      await waitForRows(RULES_COUNT);
      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);
      return { groupIdentifier, promGroup, store };
    };

    const pollOnce = async (store: ReturnType<typeof configureStore>, groupIdentifier: GrafanaRuleGroupIdentifier) => {
      const selectGroups = prometheusApi.endpoints.getGrafanaGroups.select({
        folderUid: groupIdentifier.namespace.uid,
        groupName: groupIdentifier.groupName,
        limitAlerts: 0,
      });
      const requestBeforePoll = selectGroups(store.getState()).requestId;

      await act(async () => {
        jest.advanceTimersByTime(RULE_LIST_POLL_INTERVAL_MS);
      });
      await waitFor(() => expect(selectGroups(store.getState()).requestId).not.toBe(requestBeforePoll));
      await waitFor(() => expect(selectGroups(store.getState()).status).toBe('fulfilled'));
    };

    it('does not re-render rows when the loader re-renders with the same props', async () => {
      const { loader } = setUpLargeGroup();

      const { rerender } = render(loader());
      await waitForRows(RULES_COUNT);
      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);

      rerender(loader());

      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);
    });

    it('does not re-render the row actions when only the folder name changes', async () => {
      const { loader } = setUpLargeGroup();

      const { rerender } = render(loader(grafanaRulerNamespace.uid));
      await waitForRows(RULES_COUNT);
      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);

      rerender(loader(grafanaRulerNamespace.name));

      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);
    });

    it('does not re-render rows when a poll returns unchanged data', async () => {
      const { groupIdentifier, store } = await renderLargeGroupWithFakeTimers();

      await pollOnce(store, groupIdentifier);

      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);
    });

    it('does not re-render rows when a poll only bumps the evaluation timestamps', async () => {
      const { groupIdentifier, promGroup, store } = await renderLargeGroupWithFakeTimers();
      setGrafanaPromRules([evaluatedAt(promGroup, NEXT_EVALUATION)]);

      await pollOnce(store, groupIdentifier);

      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT);
    });

    it('re-renders only the row whose data changed when a poll also bumps every evaluation timestamp', async () => {
      const { groupIdentifier, promGroup, store } = await renderLargeGroupWithFakeTimers();
      const [firstRule, ...otherRules] = promGroup.rules;
      const firingFirstRule = prometheusRuleType.grafana.alertingRule(firstRule)
        ? { ...firstRule, state: PromAlertingRuleState.Firing }
        : firstRule;
      setGrafanaPromRules([evaluatedAt({ ...promGroup, rules: [firingFirstRule, ...otherRules] }, NEXT_EVALUATION)]);

      await pollOnce(store, groupIdentifier);

      expect(mockRuleActionsButtons).toHaveBeenCalledTimes(RULES_COUNT + 1);
    });
  });
});

function buildRulerGroup(rulesCount: number): RulerRuleGroupDTO<RulerGrafanaRuleDTO> {
  const [template] = grafanaRulerGroup.rules;
  return {
    ...grafanaRulerGroup,
    rules: Array.from({ length: rulesCount }, (_, index) => ({
      ...template,
      grafana_alert: { ...template.grafana_alert, uid: `rule-uid-${index}`, title: `Rule ${index}` },
    })),
  };
}

function rulerGroupToPromGroup(group: RulerRuleGroupDTO<RulerGrafanaRuleDTO>): GrafanaPromRuleGroupDTO {
  return {
    folderUid: group.name,
    name: group.name,
    file: group.name,
    rules: group.rules.map<GrafanaPromRuleDTO>((r) => rulerRuleToPromRule(r)),
    interval: intervalToSeconds(group.interval ?? '1m'),
  };
}

function evaluatedAt(
  group: GrafanaPromRuleGroupDTO,
  evaluation: { lastEvaluation: string; evaluationTime: number }
): GrafanaPromRuleGroupDTO {
  return { ...group, rules: group.rules.map((rule) => ({ ...rule, ...evaluation })) };
}

function rulerRuleToPromRule(rule: RulerGrafanaRuleDTO): GrafanaPromRuleDTO {
  return {
    name: rule.grafana_alert.title,
    query: JSON.stringify(rule.grafana_alert.data),
    uid: rule.grafana_alert.uid,
    folderUid: rule.grafana_alert.namespace_uid,
    isPaused: false,
    health: 'ok',
    state: PromAlertingRuleState.Inactive,
    type: rulerRuleType.grafana.alertingRule(rule) ? PromRuleType.Alerting : PromRuleType.Recording,
    totals: {},
    totalsFiltered: {},
  };
}

function getGroupIdentifier(
  group: RulerRuleGroupDTO<RulerGrafanaRuleDTO> | GrafanaPromRuleGroupDTO
): GrafanaRuleGroupIdentifier {
  return {
    groupName: group.name,
    namespace: { uid: grafanaRulerNamespace.uid },
    groupOrigin: 'grafana',
  };
}
