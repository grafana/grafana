import { PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockRulerAlertingRule, mockRulerGrafanaRule, mockRulerRecordingRule } from '../../mocks';

import { deleteRuleAction, pauseRuleAction, ruleGroupReducer } from './ruleGroups';

describe('pausing rules', () => {
  // pausing only works for Grafana managed rules
  it('should pause a Grafana managed rule in a group', () => {
    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [
        mockRulerGrafanaRule({}, { uid: '1' }),
        mockRulerGrafanaRule({}, { uid: '2' }),
        mockRulerGrafanaRule({}, { uid: '3' }),
      ],
    };

    // we will pause rule with UID "2"
    const action = pauseRuleAction({ uid: '2', pause: true });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('rules');
    expect(output.rules).toHaveLength(initialGroup.rules.length);

    expect(output).toHaveProperty('rules.1.grafana_alert.is_paused', true);
    expect(output.rules[0]).toStrictEqual(initialGroup.rules[0]);
    expect(output.rules[2]).toStrictEqual(initialGroup.rules[2]);

    expect(output).toMatchSnapshot();
  });

  it('should throw if the uid does not exist in the group', () => {
    const group: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [mockRulerGrafanaRule({}, { uid: '1' })],
    };

    const action = pauseRuleAction({ uid: '2', pause: true });

    expect(() => {
      ruleGroupReducer(group, action);
    }).toThrow();
  });
});

describe('removing a rule', () => {
  it('should remove a Grafana managed ruler rule without touching other rules', () => {
    const ruleToDelete = mockRulerGrafanaRule({}, { uid: '2' });

    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [mockRulerGrafanaRule({}, { uid: '1' }), ruleToDelete, mockRulerGrafanaRule({}, { uid: '3' })],
    };

    const action = deleteRuleAction({ rule: ruleToDelete });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('rules');
    expect(output.rules).toHaveLength(2);
    expect(output.rules[0]).toStrictEqual(initialGroup.rules[0]);
    expect(output.rules[1]).toStrictEqual(initialGroup.rules[2]);

    expect(output).toMatchSnapshot();
  });

  it('should remove a Data source managed ruler rule without touching other rules', () => {
    const ruleToDelete = mockRulerAlertingRule({
      alert: 'delete me',
    });

    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [
        mockRulerAlertingRule({ alert: 'do not delete me' }),
        ruleToDelete,
        mockRulerRecordingRule({
          record: 'do not delete me',
        }),
      ],
    };

    const action = deleteRuleAction({ rule: ruleToDelete });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('rules');

    expect(output.rules).toHaveLength(2);
    expect(output.rules[0]).toStrictEqual(initialGroup.rules[0]);
    expect(output.rules[1]).toStrictEqual(initialGroup.rules[2]);

    expect(output).toMatchSnapshot();
  });
});
