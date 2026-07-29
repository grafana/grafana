import { useFolder } from '../../hooks/useFolder';
import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource } from '../../utils/datasource';
import { groups } from '../../utils/navigation';
import { parsePrometheusDuration } from '../../utils/time';
import { createRelativeUrl } from '../../utils/url';
import { GrafanaRuleType, type RuleSearchHit } from '../hooks/useK8sRulesSearch';

import { AlertRuleListItem, RecordingRuleListItem, type RuleListItemCommonProps } from './AlertRuleListItem';
import { K8sRuleActions } from './K8sRuleActions';

interface K8sSearchRuleListItemProps {
  hit: RuleSearchHit;
}

/**
 * Maps a single pure-k8s search hit to the presentational rule list item. Definition-only: no
 * state/health/instances (the `/search` endpoint doesn't return them). `hit.name` is the k8s uid,
 * `hit.title` is the display name.
 */
export function K8sSearchRuleListItem({ hit }: K8sSearchRuleListItemProps) {
  const { folder } = useFolder(hit.folder);

  const commonProps: RuleListItemCommonProps = {
    name: hit.title,
    href: createRelativeUrl(`/alerting/grafana/${hit.name}/view`),
    namespace: folder?.title,
    group: hit.group,
    groupUrl: hit.group ? groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, hit.folder, hit.group) : undefined,
    rulesSource: GrafanaRulesSource,
    application: 'grafana',
    isPaused: hit.paused,
    labels: hit.labels,
    querySourceUIDs: hit.datasourceUIDs,
    evalIntervalSeconds: hit.interval ? parsePrometheusDuration(hit.interval) / 1000 : undefined,
    actions: <K8sRuleActions uid={hit.name} />,
  };

  if (hit.type === GrafanaRuleType.Alerting) {
    return <AlertRuleListItem {...commonProps} />;
  }

  return <RecordingRuleListItem {...commonProps} />;
}
