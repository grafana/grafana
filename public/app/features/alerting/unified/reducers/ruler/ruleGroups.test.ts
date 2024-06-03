import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockRulerGrafanaRule } from '../../mocks';

import { pauseRuleAction, ruleGroupReducer } from './ruleGroups';

describe('test pausing rules', () => {
  it('should pause a single rule in a group', () => {
    const initialGroup: RulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [
        mockRulerGrafanaRule({}, { uid: '1' }),
        mockRulerGrafanaRule({}, { uid: '2' }),
        mockRulerGrafanaRule({}, { uid: '3' }),
      ],
    };

    // pause rule 2
    const action = pauseRuleAction({ uid: '2', pause: true });

    // assert output
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('rules');
    expect(output.rules).toHaveLength(initialGroup.rules.length);

    // only UID 2 should be paused
    expect(output).toHaveProperty('rules.1.grafana_alert.is_paused', true);

    // use this to assert no regressions and rule group order / data structure
    expect(output).toMatchSnapshot();
  });
});
