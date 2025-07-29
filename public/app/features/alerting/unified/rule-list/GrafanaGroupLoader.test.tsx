import { render } from 'test/test-utils';
import { byRole, byTitle } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import {
  GrafanaPromRuleDTO,
  GrafanaPromRuleGroupDTO,
  PromAlertingRuleState,
  PromRuleType,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { grafanaRulerGroup, grafanaRulerNamespace } from '../mocks/grafanaRulerApi';
import { setFolderAccessControl, setGrafanaPromRules } from '../mocks/server/configure';
import { rulerRuleType } from '../utils/rules';
import { intervalToSeconds } from '../utils/time';

import { GrafanaGroupLoader } from './GrafanaGroupLoader';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

const ui = {
  ruleItem: (ruleName: string) => byRole('treeitem', { name: ruleName }),
  ruleStatus: (status: string) => byTitle(status),
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
  },
};

describe('GrafanaGroupLoader', () => {
  beforeEach(() => {
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
});

function rulerGroupToPromGroup(group: RulerRuleGroupDTO<RulerGrafanaRuleDTO>): GrafanaPromRuleGroupDTO {
  return {
    folderUid: group.name,
    name: group.name,
    file: group.name,
    rules: group.rules.map<GrafanaPromRuleDTO>((r) => rulerRuleToPromRule(r)),
    interval: intervalToSeconds(group.interval ?? '1m'),
  };
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
