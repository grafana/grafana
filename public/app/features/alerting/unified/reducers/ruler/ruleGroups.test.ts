import { createAction } from '@reduxjs/toolkit';
import { omit } from 'lodash';

import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockGrafanaRulerRule, mockRulerAlertingRule, mockRulerGrafanaRule, mockRulerRecordingRule } from '../../mocks';
import { fromRulerRule } from '../../utils/rule-id';

import {
  SwapOperation,
  addRuleAction,
  deleteRuleAction,
  moveRuleGroupAction,
  pauseRuleAction,
  renameRuleGroupAction,
  reorder,
  reorderRulesInRuleGroupAction,
  ruleGroupReducer,
  swapItems,
  updateRuleAction,
  updateRuleGroupAction,
} from './ruleGroups';

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
    const ruleIdentifier = fromRulerRule('my-datasource', 'my-namespace', 'group-1', ruleToDelete);

    const action = deleteRuleAction({ identifier: ruleIdentifier });
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
    const ruleIdentifier = fromRulerRule('my-datasource', 'my-namespace', 'group-1', ruleToDelete);

    const action = deleteRuleAction({ identifier: ruleIdentifier });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('rules');

    expect(output.rules).toHaveLength(2);
    expect(output.rules[0]).toStrictEqual(initialGroup.rules[0]);
    expect(output.rules[1]).toStrictEqual(initialGroup.rules[2]);

    expect(output).toMatchSnapshot();
  });
});

describe('add rule', () => {
  it('should add a single rule to a rule group', () => {
    const ruleToAdd = mockGrafanaRulerRule({ uid: '3' });

    const rule1 = mockRulerGrafanaRule({}, { uid: '1' });
    const rule2 = mockRulerGrafanaRule({}, { uid: '2' });

    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [rule1, rule2],
    };

    const action = addRuleAction({ rule: ruleToAdd });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('name', 'group-1');
    expect(output).toHaveProperty('interval', '5m');

    expect(output.rules).toHaveLength(3);
    expect(output.rules[0]).toBe(rule1);
    expect(output.rules[1]).toBe(rule2);
    expect(output.rules[2]).toBe(ruleToAdd);
  });

  it('should allow adding the rule to a new group with custom name and interval', () => {
    const ruleToAdd = mockGrafanaRulerRule({ uid: '1' });

    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'default',
      interval: '1m',
      rules: [],
    };

    const action = addRuleAction({ rule: ruleToAdd, groupName: 'new group', interval: '10m' });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output).toHaveProperty('name', 'new group');
    expect(output).toHaveProperty('interval', '10m');

    expect(output.rules).toHaveLength(1);
    expect(output.rules[0]).toBe(ruleToAdd);
  });
});

describe('update rule', () => {
  it('should update a single rule in a rule group', () => {
    const ruleToUpdate = mockGrafanaRulerRule({ uid: '1' });
    const ruleIdentifier = fromRulerRule('datasource', 'namespace', 'group', ruleToUpdate);
    const updatedRule: typeof ruleToUpdate = { ...ruleToUpdate, labels: { foo: 'bar' } };

    const otherRule = mockRulerGrafanaRule({}, { uid: '2' });

    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [ruleToUpdate, otherRule],
    };

    const action = updateRuleAction({ identifier: ruleIdentifier, rule: updatedRule });
    const output = ruleGroupReducer(initialGroup, action);

    expect(output.rules).toHaveLength(2);
    expect(output.rules[0]).toStrictEqual(updatedRule);
    expect(output.rules[1]).toBe(otherRule);
  });

  it('should throw when rule is not found', () => {
    const rule = mockGrafanaRulerRule({ uid: '1' });
    const ruleIdentifier: GrafanaRuleIdentifier = {
      uid: 'wrong one',
      ruleSourceName: 'grafana',
    };

    const initialGroup: PostableRulerRuleGroupDTO = {
      name: 'group-1',
      interval: '5m',
      rules: [rule],
    };

    const action = updateRuleAction({ identifier: ruleIdentifier, rule });
    expect(() => {
      ruleGroupReducer(initialGroup, action);
    }).toThrow('no rule matching identifier found');
  });
});

describe('re-order rules', () => {
  const r1 = mockGrafanaRulerRule({ uid: 'r1' });
  const r2 = mockGrafanaRulerRule({ uid: 'r2' });
  const r3 = mockGrafanaRulerRule({ uid: 'r3' });

  const initialGroup: PostableRulerRuleGroupDTO = {
    name: 'group-1',
    interval: '5m',
    rules: [r1, r2, r3],
  };

  const swaps: SwapOperation[] = [
    [0, 1],
    [2, 1],
  ];
  const action = reorderRulesInRuleGroupAction({ swaps });
  const output = ruleGroupReducer(initialGroup, action);

  expect(output.rules).toHaveLength(3);
});

describe('rename rule group', () => {
  const initialGroup: PostableRulerRuleGroupDTO = {
    name: 'group-1',
    interval: '5m',
    rules: [],
  };

  it('should allow updating the group name and interval', () => {
    const output = ruleGroupReducer(initialGroup, renameRuleGroupAction({ groupName: 'group-2', interval: '999m' }));
    expect(output).toHaveProperty('name', 'group-2');
    expect(output).toHaveProperty('interval', '999m');

    expect(omit(output, ['name', 'interval'])).toEqual(omit(initialGroup, ['name', 'interval']));
  });
});

describe('move rule group', () => {
  const initialGroup: PostableRulerRuleGroupDTO = {
    name: 'group-1',
    interval: '5m',
    rules: [],
  };

  it('should allow updating the group name and interval', () => {
    const output = ruleGroupReducer(
      initialGroup,
      moveRuleGroupAction({ newNamespaceName: 'doesnt-really-matter', groupName: 'group-2', interval: '999m' })
    );
    expect(output).toHaveProperty('name', 'group-2');
    expect(output).toHaveProperty('interval', '999m');

    expect(omit(output, ['name', 'interval'])).toEqual(omit(initialGroup, ['name', 'interval']));
  });
});

describe('update rule group', () => {
  const initialGroup: PostableRulerRuleGroupDTO = {
    name: 'group-1',
    interval: '5m',
    rules: [],
  };

  it('should allow updating the interval', () => {
    const output = ruleGroupReducer(initialGroup, updateRuleGroupAction({ interval: '999m' }));
    expect(output).toHaveProperty('interval', '999m');

    expect(omit(output, 'interval')).toEqual(omit(initialGroup, 'interval'));
  });
});

describe('unknown actions', () => {
  it('should throw for unknown actions', () => {
    expect(() => {
      const initialGroup: PostableRulerRuleGroupDTO = {
        name: 'group-1',
        interval: '5m',
        rules: [],
      };

      const unknownAction = createAction('unkown');

      // @ts-expect-error
      ruleGroupReducer(initialGroup, unknownAction);
    }).toThrow('Unknown action');
  });
});

describe('reorder and swap', () => {
  it('should reorder arrays', () => {
    const original = [1, 2, 3];
    const operations = [
      [1, 2],
      [0, 2],
    ] satisfies SwapOperation[];
    const expected = [3, 2, 1];

    expect(reorder(original, operations)).toEqual(expected);
    expect(original).toEqual(expected); // make sure it mutates so we can use it in produce functions
  });

  it('inverse swaps should cancel out', () => {
    const original = [1, 2, 3];
    const operations = [
      [1, 2],
      [2, 1],
    ] satisfies SwapOperation[];

    expect(reorder(original, operations)).toEqual(original);
  });

  it('should throw when swapping out of bounds', () => {
    expect(() => {
      swapItems([], [-1, 3]);
    }).toThrow('out of bounds');
  });
});
