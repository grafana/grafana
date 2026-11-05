import { grafanaRulesNav } from './navigation';

describe('grafanaRulesNav', () => {
  it('builds the view link from the rule UID', () => {
    expect(grafanaRulesNav.viewLink('rule-uid-1')).toBe('/alerting/grafana/rule-uid-1/view');
  });
});
