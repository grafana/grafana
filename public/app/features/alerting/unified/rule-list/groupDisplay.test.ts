import { NO_GROUP_PREFIX } from '../utils/rules';

import { groupRulesByGroup, isUngroupedOrEmpty } from './groupDisplay';
import { type GrafanaRuleWithOrigin } from './hooks/useFilteredRulesIterator';

function makeRule(uid: string, groupName: string): GrafanaRuleWithOrigin {
  return {
    // Only the fields read by groupRulesByGroup matter for these tests.
    rule: { uid } as GrafanaRuleWithOrigin['rule'],
    groupIdentifier: { namespace: { uid: 'folder-1' }, groupName, groupOrigin: 'grafana' },
    namespaceName: 'Folder 1',
    origin: 'grafana',
  };
}

const uids = (rules: GrafanaRuleWithOrigin[]) => rules.map((r) => r.rule.uid);

describe('isUngroupedOrEmpty', () => {
  it.each([
    ['', true],
    [undefined, true],
    [`${NO_GROUP_PREFIX}abc`, true],
    ['my-group', false],
  ])('treats %p as ungrouped=%p', (groupName, expected) => {
    expect(isUngroupedOrEmpty(groupName)).toBe(expected);
  });
});

describe('groupRulesByGroup', () => {
  it('buckets contiguous rules and preserves first-seen order', () => {
    const rules = [makeRule('a', 'group-1'), makeRule('b', 'group-1'), makeRule('c', 'group-2')];

    const { groups, ungrouped } = groupRulesByGroup(rules);

    expect(ungrouped).toHaveLength(0);
    expect(groups.map((g) => g.groupName)).toEqual(['group-1', 'group-2']);
    expect(uids(groups[0].rules)).toEqual(['a', 'b']);
    expect(uids(groups[1].rules)).toEqual(['c']);
  });

  it('separates empty and sentinel groups into the ungrouped bucket', () => {
    const rules = [makeRule('a', 'group-1'), makeRule('b', ''), makeRule('c', `${NO_GROUP_PREFIX}c`)];

    const { groups, ungrouped } = groupRulesByGroup(rules);

    expect(groups.map((g) => g.groupName)).toEqual(['group-1']);
    expect(uids(ungrouped)).toEqual(['b', 'c']);
  });

  it('merges a group split across the list (e.g. partial pages) into a single bucket', () => {
    const rules = [makeRule('a', 'group-1'), makeRule('b', 'group-2'), makeRule('c', 'group-1')];

    const { groups } = groupRulesByGroup(rules);

    expect(groups.map((g) => g.groupName)).toEqual(['group-1', 'group-2']);
    expect(uids(groups[0].rules)).toEqual(['a', 'c']);
  });
});
