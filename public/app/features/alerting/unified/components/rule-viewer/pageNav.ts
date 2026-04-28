import { type NavModelItem } from '@grafana/data';

import { createListFilterLink } from '../../utils/navigation';
import { isUngroupedRuleGroup } from '../../utils/rules';

export function buildRuleViewerParentItem(
  groupName: string,
  namespaceName: string,
  groupDetailsUrl: string
): NavModelItem {
  const namespaceParentItem: NavModelItem = {
    text: namespaceName,
    url: createListFilterLink([['namespace', namespaceName]]),
  };

  if (isUngroupedRuleGroup(groupName)) {
    return namespaceParentItem;
  }

  return {
    text: groupName,
    url: groupDetailsUrl,
    parentItem: namespaceParentItem,
  };
}
