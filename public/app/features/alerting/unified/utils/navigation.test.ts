import { grafanaRulesNav } from './navigation';

describe('grafanaRulesNav', () => {
  it('builds the view link from the rule UID', () => {
    expect(grafanaRulesNav.viewLink('rule-uid-1')).toBe('/alerting/grafana/rule-uid-1/view');
  });

  it('builds the rule list link for a kind with the search encoded', () => {
    expect(grafanaRulesNav.ruleListLink('recording', 'folder:"Team 01" cpu')).toBe(
      '/alerting/rules/recording?search=folder%3A%22Team+01%22+cpu'
    );
  });
});
