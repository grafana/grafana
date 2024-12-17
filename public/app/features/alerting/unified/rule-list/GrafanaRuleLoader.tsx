import { GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { GrafanaRulesSource } from '../utils/datasource';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';

interface GrafanaRuleLoaderProps {
  rule: GrafanaPromRuleDTO;
  groupName: string;
  // TODO: How to improve this?
  namespaceName: string;
}

export function GrafanaRuleLoader({ rule, groupName, namespaceName }: GrafanaRuleLoaderProps) {
  const { folderUid } = rule;

  switch (rule.type) {
    case PromRuleType.Alerting:
      return (
        <AlertRuleListItem
          name={rule.name}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          group={groupName}
          namespace={namespaceName}
          href={''}
          summary={rule.annotations?.summary}
          state={rule.state}
          health={rule.health}
          error={rule.lastError}
          labels={rule.labels}
          isProvisioned={undefined}
          instancesCount={rule.alerts?.length}
        />
      );
    case PromRuleType.Recording:
      return (
        <RecordingRuleListItem
          name={rule.name}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          group={groupName}
          namespace={namespaceName}
          href={''}
          health={rule.health}
          error={rule.lastError}
          labels={rule.labels}
          isProvisioned={undefined}
        />
      );
    default:
      return (
        <UnknownRuleListItem
          rule={rule}
          groupIdentifier={{
            rulesSource: GrafanaRulesSource,
            groupName,
            namespace: { uid: folderUid },
            groupOrigin: 'grafana',
          }}
        />
      );
  }
}
