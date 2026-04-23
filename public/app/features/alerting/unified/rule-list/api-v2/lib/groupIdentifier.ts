import { type RuleGroup, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { type TreeDataSource, type TreeFolder } from './types';

export function buildGroupIdentifier(
  dataSource: TreeDataSource,
  folder: TreeFolder,
  group: RuleGroup
): RuleGroupIdentifierV2 {
  if (dataSource.isGrafana) {
    return {
      groupName: group.name,
      namespace: { uid: folder.key },
      groupOrigin: 'grafana',
    };
  }
  return {
    rulesSource: {
      uid: dataSource.uid,
      name: dataSource.name,
      ruleSourceType: 'datasource',
    },
    groupName: group.name,
    namespace: { name: folder.title },
    groupOrigin: 'datasource',
  };
}
