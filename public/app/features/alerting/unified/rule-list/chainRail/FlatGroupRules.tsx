import { Fragment, useMemo } from 'react';

import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GrafanaRuleListItem } from '../GrafanaRuleListItem';

interface FlatGroupRulesProps {
  group: GrafanaPromRuleGroupDTO;
  namespaceName: string;
}

// Renders every rule in an evaluation group as a standalone inline row. The
// group header is not rendered — per the chain-rail spec the evaluation-group
// level is removed, and rules live as equal siblings of chain clusters.
export function FlatGroupRules({ group, namespaceName }: FlatGroupRulesProps) {
  const groupIdentifier: GrafanaRuleGroupIdentifier = useMemo(
    () => ({
      groupName: group.name,
      namespace: { uid: group.folderUid },
      groupOrigin: 'grafana',
    }),
    [group.name, group.folderUid]
  );

  return (
    <>
      {group.rules.map((rule) => (
        <Fragment key={rule.uid}>
          <GrafanaRuleListItem
            rule={rule}
            groupIdentifier={groupIdentifier}
            namespaceName={namespaceName}
            showLocation={false}
          />
        </Fragment>
      ))}
    </>
  );
}
