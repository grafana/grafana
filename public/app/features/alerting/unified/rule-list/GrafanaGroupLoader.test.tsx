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
import { grafanaRulerGroup, grafanaRulerNamespace } from '../mocks/grafanaRulerApi';
import { setGrafanaPromRules } from '../mocks/server/configure';
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
    expect(ruleLink).toHaveAttribute(
      'href',
      expect.stringContaining(`/alerting/grafana/${rule1.grafana_alert.uid}/view`)
    );
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
