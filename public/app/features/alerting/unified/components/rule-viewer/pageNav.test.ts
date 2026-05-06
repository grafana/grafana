import { createListFilterLink, groups } from '../../utils/navigation';
import { NO_GROUP_PREFIX } from '../../utils/rules';

import { type RuleViewerNamespaceInfo, buildRuleViewerParentItem } from './pageNav';

const dataSourceUID = 'grafana';
const folderUID = 'my-folder-uid';

function makeNamespace(overrides?: Partial<RuleViewerNamespaceInfo>): RuleViewerNamespaceInfo {
  return {
    displayName: 'My Folder',
    parentNames: [],
    identifier: { uid: folderUID },
    dataSourceUID,
    ...overrides,
  };
}

describe('buildRuleViewerParentItem', () => {
  it('skips the group level for ungrouped rules', () => {
    const ungroupedName = `${NO_GROUP_PREFIX}abc123${'*'.repeat(180)}`;

    const parentItem = buildRuleViewerParentItem(ungroupedName, makeNamespace());

    expect(parentItem).toEqual({
      text: 'My Folder',
      url: createListFilterLink([['namespace', 'My Folder']]),
    });
    expect(parentItem.parentItem).toBeUndefined();
  });

  it('keeps the full group → namespace chain for real groups', () => {
    const groupName = 'my-group';

    const parentItem = buildRuleViewerParentItem(groupName, makeNamespace());

    expect(parentItem).toEqual({
      text: groupName,
      url: groups.detailsPageLink(dataSourceUID, folderUID, groupName),
      parentItem: {
        text: 'My Folder',
        url: createListFilterLink([['namespace', 'My Folder']]),
      },
    });
  });

  it('builds a full parent chain for rules in nested folders', () => {
    const groupName = 'my-group';
    const namespace = makeNamespace({
      displayName: 'Child Folder',
      parentNames: ['Root Folder', 'Parent Folder'],
    });

    const parentItem = buildRuleViewerParentItem(groupName, namespace);

    expect(parentItem).toEqual({
      text: groupName,
      url: groups.detailsPageLink(dataSourceUID, folderUID, groupName),
      parentItem: {
        text: 'Child Folder',
        url: createListFilterLink([['namespace', 'Child Folder']]),
        parentItem: {
          text: 'Parent Folder',
          url: createListFilterLink([['namespace', 'Parent Folder']]),
          parentItem: {
            text: 'Root Folder',
            url: createListFilterLink([['namespace', 'Root Folder']]),
            parentItem: undefined,
          },
        },
      },
    });
  });

  it('skips the group level AND shows full parent chain for ungrouped rules in nested folders', () => {
    const ungroupedName = `${NO_GROUP_PREFIX}abc123`;
    const namespace = makeNamespace({
      displayName: 'Child Folder',
      parentNames: ['Root Folder'],
    });

    const parentItem = buildRuleViewerParentItem(ungroupedName, namespace);

    expect(parentItem).toEqual({
      text: 'Child Folder',
      url: createListFilterLink([['namespace', 'Child Folder']]),
      parentItem: {
        text: 'Root Folder',
        url: createListFilterLink([['namespace', 'Root Folder']]),
        parentItem: undefined,
      },
    });
  });
});
