import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { sortRulesByName, transformGrafanaManagedRules } from './useCombinedRuleNamespaces';

describe('transformGrafanaManagedRules', () => {
  it('should properly transform grafana managed namespaces', () => {
    // the rules from both ungrouped groups should go in the default group
    const ungroupedGroup1 = {
      name: 'my-rule',
      rules: [{ name: 'my-rule' }],
    } as CombinedRuleGroup;

    const ungroupedGroup2 = {
      name: 'another-rule',
      rules: [{ name: 'another-rule' }],
    } as CombinedRuleGroup;

    // the rules from both these groups should go in their own group name
    const group1 = {
      name: 'group1',
      rules: [{ name: 'rule-1' }, { name: 'rule-2' }],
    } as CombinedRuleGroup;

    const group2 = {
      name: 'group2',
      rules: [{ name: 'rule-1' }, { name: 'rule-2' }],
    } as CombinedRuleGroup;

    const namespace1 = {
      rulesSource: 'grafana',
      name: 'ns1',
      groups: [ungroupedGroup1, ungroupedGroup2, group1, group2],
    };

    const namespace2 = {
      rulesSource: 'grafana',
      name: 'ns2',
      groups: [ungroupedGroup1],
    };

    const input = [namespace1, namespace2] as CombinedRuleNamespace[];
    const [ns1, ns2] = transformGrafanaManagedRules(input);

    expect(ns1.groups).toEqual([
      {
        name: 'group1',
        rules: group1.rules,
      },
      {
        name: 'group2',
        rules: group2.rules,
      },
      {
        name: 'default',
        rules: sortRulesByName([...ungroupedGroup1.rules, ...ungroupedGroup2.rules]),
      },
    ]);

    expect(ns2.groups).toEqual([
      {
        name: 'default',
        rules: ungroupedGroup1.rules,
      },
    ]);
  });
});
