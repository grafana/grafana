import { render } from 'test/test-utils';
import { byRole, byTitle } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
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
import { mockGrafanaPromAlertingRule, mockGrafanaRulerRule } from '../mocks';
import { grafanaRulerGroup, grafanaRulerNamespace } from '../mocks/grafanaRulerApi';
import { setGrafanaPromRules } from '../mocks/server/configure';
import { rulerRuleType } from '../utils/rules';
import { intervalToSeconds } from '../utils/time';

import { GrafanaGroupLoader, matchRules } from './GrafanaGroupLoader';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

const ui = {
  ruleItem: (ruleName: string) => byRole('treeitem', { name: ruleName }),
  ruleStatus: (status: string) => byTitle(status),
  ruleLink: (ruleName: string) => byRole('link', { name: ruleName }),
  editButton: () => byRole('link', { name: 'Edit' }),
  moreButton: () => byRole('button', { name: 'More' }),
};

describe('GrafanaGroupLoader', () => {
  it('should render rule with url when ruler and prom rule exist', async () => {
    setGrafanaPromRules([rulerGroupToPromGroup(grafanaRulerGroup)]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    const ruleStatus = ui.ruleStatus('Normal').get(ruleListItem);
    expect(ruleStatus).toBeInTheDocument();

    const ruleLink = ui.ruleLink(rule1.grafana_alert.title).get(ruleListItem);
    expect(ruleLink).toHaveAttribute('href', `/alerting/grafana/${rule1.grafana_alert.uid}/view`);
  });

  it('should render rule with url and creating state when only ruler rule exists', async () => {
    setGrafanaPromRules([]);

    const groupIdentifier = getGroupIdentifier(grafanaRulerGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    const [rule1] = grafanaRulerGroup.rules;
    const ruleListItem = await ui.ruleItem(rule1.grafana_alert.title).find();

    const creatingIcon = ui.ruleStatus('Creating').get(ruleListItem);
    expect(creatingIcon).toBeInTheDocument();

    const ruleLink = ui.ruleLink(rule1.grafana_alert.title).get(ruleListItem);
    expect(ruleLink).toHaveAttribute('href', `/alerting/grafana/${rule1.grafana_alert.uid}/view`);
  });

  it('should render delete rule operation list item when only prom rule exists', async () => {
    const promOnlyGroup: GrafanaPromRuleGroupDTO = {
      ...rulerGroupToPromGroup(grafanaRulerGroup),
      name: 'prom-only-group',
    };

    setGrafanaPromRules([promOnlyGroup]);

    const groupIdentifier = getGroupIdentifier(promOnlyGroup);

    render(<GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={grafanaRulerNamespace.name} />);

    const [rule1] = promOnlyGroup.rules;
    const promRule = await ui.ruleItem(rule1.name).find();

    const deletingIcon = ui.ruleStatus('Deleting').get(promRule);
    expect(deletingIcon).toBeInTheDocument();

    expect(ui.editButton().query(promRule)).not.toBeInTheDocument();
    expect(ui.moreButton().query(promRule)).not.toBeInTheDocument();
  });
});

describe('matchRules', () => {
  it('should return matches for all items and have empty promOnlyRules if all rules are matched by uid', () => {
    const rulerRules = [
      mockGrafanaRulerRule({ uid: '1' }),
      mockGrafanaRulerRule({ uid: '2' }),
      mockGrafanaRulerRule({ uid: '3' }),
    ];

    const promRules = rulerRules.map(rulerRuleToPromRule);

    const { matches, promOnlyRules } = matchRules(promRules, rulerRules);

    expect(matches.size).toBe(rulerRules.length);
    expect(promOnlyRules).toHaveLength(0);

    for (const [rulerRule, promRule] of matches) {
      expect(rulerRule.grafana_alert.uid).toBe(promRule.uid);
    }
  });

  it('should return unmatched prometheus rules in promOnlyRules array', () => {
    const rulerRules = [mockGrafanaRulerRule({ uid: '1' }), mockGrafanaRulerRule({ uid: '2' })];

    const matchingPromRules = rulerRules.map(rulerRuleToPromRule);
    const unmatchedPromRules = [mockGrafanaPromAlertingRule({ uid: '3' }), mockGrafanaPromAlertingRule({ uid: '4' })];

    const allPromRules = [...matchingPromRules, ...unmatchedPromRules];
    const { matches, promOnlyRules } = matchRules(allPromRules, rulerRules);

    expect(matches.size).toBe(rulerRules.length);
    expect(promOnlyRules).toHaveLength(unmatchedPromRules.length);
    expect(promOnlyRules).toEqual(expect.arrayContaining(unmatchedPromRules));
  });

  it('should not include ruler rules in matches if they have no prometheus counterpart', () => {
    const rulerRules = [
      mockGrafanaRulerRule({ uid: '1' }),
      mockGrafanaRulerRule({ uid: '2' }),
      mockGrafanaRulerRule({ uid: '3' }),
    ];

    // Only create prom rule for the second ruler rule
    const promRules = [rulerRuleToPromRule(rulerRules[1])];

    const { matches, promOnlyRules } = matchRules(promRules, rulerRules);

    expect(matches.size).toBe(1);
    expect(promOnlyRules).toHaveLength(0);

    // Verify that only the second ruler rule is in matches
    expect(matches.has(rulerRules[0])).toBe(false);
    expect(matches.get(rulerRules[1])).toBe(promRules[0]);
    expect(matches.has(rulerRules[2])).toBe(false);
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
