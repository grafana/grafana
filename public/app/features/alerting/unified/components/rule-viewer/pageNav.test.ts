import { createListFilterLink } from '../../utils/navigation';
import { NO_GROUP_PREFIX } from '../../utils/rules';

import { buildRuleViewerParentItem } from './pageNav';

describe('buildRuleViewerParentItem', () => {
  const namespaceName = 'My Folder';
  const groupDetailsUrl = '/alerting/grafana/namespaces/my-folder-uid/groups/my-group/view';

  it('skips the group level for ungrouped rules', () => {
    const ungroupedName = `${NO_GROUP_PREFIX}abc123${'*'.repeat(180)}`;

    const parentItem = buildRuleViewerParentItem(ungroupedName, namespaceName, groupDetailsUrl);

    expect(parentItem).toEqual({
      text: namespaceName,
      url: createListFilterLink([['namespace', namespaceName]]),
    });
    expect(parentItem.parentItem).toBeUndefined();
  });

  it('keeps the full group → namespace chain for real groups', () => {
    const groupName = 'my-group';

    const parentItem = buildRuleViewerParentItem(groupName, namespaceName, groupDetailsUrl);

    expect(parentItem).toEqual({
      text: groupName,
      url: groupDetailsUrl,
      parentItem: {
        text: namespaceName,
        url: createListFilterLink([['namespace', namespaceName]]),
      },
    });
  });
});
