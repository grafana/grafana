import { type NavModelItem } from '@grafana/data';
import { type DataSourceNamespaceIdentifier, type GrafanaNamespaceIdentifier } from 'app/types/unified-alerting';

import { createListFilterLink, groups } from '../../utils/navigation';
import { isUngroupedRuleGroup } from '../../utils/rules';

/** Minimal namespace info needed to build rule viewer breadcrumb navigation. */
export interface RuleViewerNamespaceInfo {
  /** Human-readable leaf namespace/folder name */
  displayName: string;
  /** Parent folder display names for nested-folder breadcrumbs (empty for root) */
  parentNames: string[];
  /** Namespace identifier used to build the group detail URL */
  identifier: GrafanaNamespaceIdentifier | DataSourceNamespaceIdentifier;
  /** Data source UID — 'grafana' for Grafana-managed rules, otherwise the datasource UID */
  dataSourceUID: string;
}

function getRouteNamespaceId(identifier: GrafanaNamespaceIdentifier | DataSourceNamespaceIdentifier): string {
  return 'uid' in identifier ? identifier.uid : identifier.name;
}

export function buildRuleViewerParentItem(groupName: string, namespace: RuleViewerNamespaceInfo): NavModelItem {
  const folderParentItem = namespace.parentNames.reduce<NavModelItem | undefined>(
    (ancestor, parentName) => ({
      text: parentName,
      url: createListFilterLink([['namespace', parentName]]),
      parentItem: ancestor,
    }),
    undefined
  );

  const namespaceParentItem: NavModelItem = {
    text: namespace.displayName,
    url: createListFilterLink([['namespace', namespace.displayName]]),
    parentItem: folderParentItem,
  };

  if (isUngroupedRuleGroup(groupName)) {
    return namespaceParentItem;
  }

  return {
    text: groupName,
    url: groups.detailsPageLink(namespace.dataSourceUID, getRouteNamespaceId(namespace.identifier), groupName),
    parentItem: namespaceParentItem,
  };
}
