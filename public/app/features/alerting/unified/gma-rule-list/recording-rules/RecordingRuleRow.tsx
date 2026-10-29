import { type ReactNode, useId } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Stack, TextLink } from '@grafana/ui';

import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import { grafanaRulesNav } from '../../utils/navigation';
import { getManagerKind, getPluginId, isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { FolderPath } from '../rule-row/FolderPath';
import { PluginOriginBadge } from '../rule-row/PluginOriginBadge';
import { ProvisioningBadge } from '../rule-row/ProvisioningBadge';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { RuleRecordedMetric } from './RuleRecordedMetric';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  searchHit: RecordingRuleSearchHit;
  fullRule: RuleResourceState<RecordingRule>;
  /** Absent while the folder path loads, when its lookup failed, or in Folders mode. */
  folderPath?: string[];
  actions?: ReactNode;
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, fullRule, folderPath, actions }: RecordingRuleRowProps) {
  const titleId = useId();
  const pluginId = getPluginId(
    searchHit.originLabel === undefined ? undefined : { [GRAFANA_ORIGIN_LABEL]: searchHit.originLabel }
  );
  const managerKind = fullRule.status === 'loaded' ? getManagerKind(fullRule.rule) : undefined;
  const isOwnedElsewhere = fullRule.status === 'loaded' && isProvisionedOrManaged(fullRule.rule);
  const href = grafanaRulesNav.viewLink(searchHit.uid, { includeReturnTo: true });
  // The write target is already shown in RuleRecordedMetric; exclude it from the queried list.
  const queriedUIDs = searchHit.datasourceUIDs?.filter((uid) => uid !== searchHit.targetDatasourceUID);

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={searchHit.health} paused={searchHit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          <TextLink id={titleId} href={href} color="primary" inline={false}>
            {searchHit.title}
          </TextLink>
          {pluginId === undefined ? (
            isOwnedElsewhere && <ProvisioningBadge managerKind={managerKind} />
          ) : (
            <PluginOriginBadge pluginId={pluginId} size="sm" />
          )}
        </Stack>
      }
      description={searchHit.lastError && <RuleDescription lastError={searchHit.lastError} />}
      right={
        (searchHit.interval || actions) && (
          <>
            {searchHit.interval && <RuleInterval interval={searchHit.interval} />}
            {actions}
          </>
        )
      }
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        // Both metric and targetDatasourceUID are required: showing "Records X to <unknown>" without
        // a destination makes no sense, and showing just the datasource without context is confusing.
        searchHit.metric && searchHit.targetDatasourceUID && (
          <RuleRecordedMetric
            key="metric"
            metric={searchHit.metric}
            targetDatasourceUID={searchHit.targetDatasourceUID}
          />
        ),
        queriedUIDs && queriedUIDs.length > 0 && <RuleDatasources key="ds" datasourceUIDs={queriedUIDs} />,
        // parseSearchLabels guarantees labels is non-empty when present; RuleLabels handles the null case.
        searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
      ]}
    />
  );
}
