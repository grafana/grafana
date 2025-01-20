import { GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { GrafanaRulesSource } from '../utils/datasource';
import { createRelativeUrl } from '../utils/url';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';

interface GrafanaRuleLoaderProps {
  rule: GrafanaPromRuleDTO;
  groupName: string;
  namespaceName: string;
}

export function GrafanaRuleLoader({ rule, groupName, namespaceName }: GrafanaRuleLoaderProps) {
  const { folderUid } = rule;

  const commonProps = {
    name: rule.name,
    rulesSource: GrafanaRulesSource,
    group: groupName,
    namespace: namespaceName,
    href: createRelativeUrl(`/alerting/grafana/${rule.uid}/view`),
    health: rule.health,
    error: rule.lastError,
    labels: rule.labels,
  };

  if (rule.type === PromRuleType.Alerting) {
    return (
      <AlertRuleListItem
        {...commonProps}
        application="grafana"
        summary={rule.annotations?.summary}
        state={rule.state}
        isProvisioned={undefined}
        instancesCount={rule.alerts?.length}
      />
    );
  }

  if (rule.type === PromRuleType.Recording) {
    return <RecordingRuleListItem {...commonProps} application="grafana" isProvisioned={undefined} />;
  }

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
