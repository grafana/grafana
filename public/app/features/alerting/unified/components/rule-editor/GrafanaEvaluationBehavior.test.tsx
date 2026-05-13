import { mockRulerRuleGroup } from '../../mocks';
import { NO_GROUP_PREFIX } from '../../utils/rules';

import { namespaceToGroupOptions } from './GrafanaEvaluationBehavior';

describe('namespaceToGroupOptions', () => {
  it('excludes ungrouped (no_group_for_rule_*) groups from the options', () => {
    const realGroup = mockRulerRuleGroup({ name: 'real-group', interval: '1m' });
    const ungroupedGroup = mockRulerRuleGroup({ name: `${NO_GROUP_PREFIX}abc123`, interval: '30s' });

    const options = namespaceToGroupOptions({ 'folder-uid': [realGroup, ungroupedGroup] }, false);

    expect(options.map((option) => option.value)).toEqual(['real-group']);
  });

  it('returns regular and other-named groups untouched', () => {
    const groupA = mockRulerRuleGroup({ name: 'group-a', interval: '1m' });
    const groupB = mockRulerRuleGroup({ name: 'group-b', interval: '5m' });

    const options = namespaceToGroupOptions({ 'folder-uid': [groupA, groupB] }, false);

    expect(options.map((option) => option.value)).toEqual(['group-a', 'group-b']);
  });
});
