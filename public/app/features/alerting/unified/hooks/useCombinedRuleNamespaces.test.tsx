import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';

import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRuleGroup, type CombinedRuleNamespace } from 'app/types/unified-alerting';

import { grantUserPermissions, mockUnifiedAlertingStore } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { NO_GROUP_PREFIX } from '../utils/rules';

import {
  UNGROUPED_VIRTUAL_GROUP_NAME,
  flattenGrafanaManagedRules,
  mergeUngroupedGrafanaRules,
  sortRulesByName,
  useCombinedRuleNamespaces,
} from './useCombinedRuleNamespaces';

describe('useCombinedRuleNamespaces', () => {
  beforeEach(() => {
    setupDataSources();
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
  });

  it('returns a namespace with an empty group when ruler rules has a group with no rules', () => {
    const store = mockUnifiedAlertingStore({
      rulerRules: {
        [GRAFANA_RULES_SOURCE_NAME]: {
          loading: false,
          dispatched: true,
          result: {
            'my-namespace': [{ name: 'my-group', rules: [] }],
          },
        },
      },
    });

    const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(() => useCombinedRuleNamespaces(), { wrapper });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      name: 'my-namespace',
      groups: [{ name: 'my-group', rules: [] }],
    });
  });

  it('returns a namespace with no groups when ruler rules has an empty groups array', () => {
    const store = mockUnifiedAlertingStore({
      rulerRules: {
        [GRAFANA_RULES_SOURCE_NAME]: {
          loading: false,
          dispatched: true,
          result: {
            'my-namespace': [],
          },
        },
      },
    });

    const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(() => useCombinedRuleNamespaces(), { wrapper });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      name: 'my-namespace',
      groups: [],
    });
  });
});

describe('flattenGrafanaManagedRules', () => {
  it('should properly transform grafana managed namespaces', () => {
    // the rules from both ungrouped groups should go in the default group
    const ungroupedGroup1 = {
      name: 'my-rule',
      rules: [{ name: 'my-rule' }],
      totals: {},
    } as CombinedRuleGroup;

    const ungroupedGroup2 = {
      name: 'another-rule',
      rules: [{ name: 'another-rule' }],
      totals: {},
    } as CombinedRuleGroup;

    // the rules from both these groups should go in their own group name
    const group1 = {
      name: 'group1',
      rules: [{ name: 'rule-1' }, { name: 'rule-2' }],
      totals: {},
    } as CombinedRuleGroup;

    const group2 = {
      name: 'group2',
      rules: [{ name: 'rule-1' }, { name: 'rule-2' }],
      totals: {},
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
    const [ns1, ns2] = flattenGrafanaManagedRules(input);

    expect(ns1.groups).toEqual([
      {
        name: 'default',
        rules: sortRulesByName([...ungroupedGroup1.rules, ...ungroupedGroup2.rules, ...group1.rules, ...group2.rules]),
        totals: {},
      },
    ]);

    expect(ns2.groups).toEqual([
      {
        name: 'default',
        rules: ungroupedGroup1.rules,
        totals: {},
      },
    ]);
  });
});

describe('mergeUngroupedGrafanaRules', () => {
  const realGroup = {
    name: 'real-group',
    interval: '1m',
    rules: [{ name: 'rule-a' }, { name: 'rule-b' }],
    totals: { alerting: 1 },
  } as CombinedRuleGroup;

  const ungroupedFoo = {
    name: `${NO_GROUP_PREFIX}foo`,
    interval: '30s',
    rules: [{ name: 'Foo' }],
    totals: { alerting: 1 },
  } as CombinedRuleGroup;

  const ungroupedBar = {
    name: `${NO_GROUP_PREFIX}bar`,
    interval: '30s',
    rules: [{ name: 'Bar' }],
    totals: { inactive: 1 },
  } as CombinedRuleGroup;

  const ungroupedBaz = {
    name: `${NO_GROUP_PREFIX}baz`,
    interval: '5m',
    rules: [{ name: 'Baz' }],
    totals: { pending: 2 },
  } as CombinedRuleGroup;

  it('merges ungrouped Grafana groups into one virtual group while leaving real groups untouched', () => {
    const namespace = {
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      name: 'folder',
      groups: [ungroupedFoo, realGroup, ungroupedBar],
    } as CombinedRuleNamespace;

    const [merged] = mergeUngroupedGrafanaRules([namespace]);

    expect(merged.groups).toHaveLength(2);
    expect(merged.groups[0]).toEqual(realGroup);
    expect(merged.groups[1]).toEqual({
      name: UNGROUPED_VIRTUAL_GROUP_NAME,
      interval: '30s',
      rules: sortRulesByName([...ungroupedFoo.rules, ...ungroupedBar.rules]),
      totals: { alerting: 1, inactive: 1 },
    });
  });

  it('produces a single virtual group when the folder only contains ungrouped rules', () => {
    const namespace = {
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      name: 'folder',
      groups: [ungroupedFoo, ungroupedBar],
    } as CombinedRuleNamespace;

    const [merged] = mergeUngroupedGrafanaRules([namespace]);

    expect(merged.groups).toHaveLength(1);
    expect(merged.groups[0].name).toBe(UNGROUPED_VIRTUAL_GROUP_NAME);
    expect(merged.groups[0].rules).toEqual(sortRulesByName([...ungroupedFoo.rules, ...ungroupedBar.rules]));
  });

  it('leaves namespaces without ungrouped rules untouched', () => {
    const namespace = {
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      name: 'folder',
      groups: [realGroup],
    } as CombinedRuleNamespace;

    const [merged] = mergeUngroupedGrafanaRules([namespace]);

    expect(merged.groups).toEqual([realGroup]);
  });

  it('passes through non-Grafana namespaces without modification', () => {
    const namespace = {
      rulesSource: { name: 'mimir' },
      name: 'folder',
      groups: [
        {
          name: `${NO_GROUP_PREFIX}foo`,
          rules: [{ name: 'Foo' }],
          totals: {},
        },
      ],
    } as unknown as CombinedRuleNamespace;

    const [merged] = mergeUngroupedGrafanaRules([namespace]);

    expect(merged).toBe(namespace);
  });

  it('drops the virtual group interval when the merged groups disagree', () => {
    const namespace = {
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      name: 'folder',
      groups: [ungroupedFoo, ungroupedBaz],
    } as CombinedRuleNamespace;

    const [merged] = mergeUngroupedGrafanaRules([namespace]);

    expect(merged.groups[0]).toMatchObject({
      name: UNGROUPED_VIRTUAL_GROUP_NAME,
      interval: undefined,
    });
  });
});
