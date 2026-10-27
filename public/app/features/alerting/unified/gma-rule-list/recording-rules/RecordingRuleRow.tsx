import { type ReactNode, useId } from 'react';

import { Stack, TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
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
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Plugin or provisioning badge; absent while the full rule loads or when there is no badge. */
  badge?: ReactNode;
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, folderPath, badge }: RecordingRuleRowProps) {
  const titleId = useId();
  const href = grafanaRulesNav.viewLink(searchHit.uid, { includeReturnTo: true });
  // The write target is already shown in RuleRecordedMetric; exclude it from the queried list.
  const queriedUIDs = searchHit.datasourceUIDs?.filter((uid) => uid !== searchHit.targetDatasourceUID);

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={searchHit.health} paused={searchHit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
          <TextLink id={titleId} href={href} color="primary" inline={false}>
            {searchHit.title}
          </TextLink>
          {badge}
        </Stack>
      }
      description={searchHit.lastError && <RuleDescription lastError={searchHit.lastError} />}
      right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}
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
