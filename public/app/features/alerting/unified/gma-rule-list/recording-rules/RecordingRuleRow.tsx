import { useId } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Stack, TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleOriginBadge } from '../rule-row/RuleOriginBadge';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';
import { EffectiveRuleInterval } from '../rule-sequences/EffectiveRuleInterval';
import { type RuleSequenceMembership } from '../rule-sequences/ruleSequenceMembership';

import { RuleRecordedMetric } from './RuleRecordedMetric';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  searchHit: RecordingRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Full rule resource; absent while loading or when the fetch failed. */
  rule?: RecordingRule;
  /** `null`: not in a sequence. Absent while loading or when the lookup failed. */
  sequence?: RuleSequenceMembership | null;
  onSequenceClick: () => void;
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, folderPath, rule, sequence, onSequenceClick }: RecordingRuleRowProps) {
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
          {rule && <RuleOriginBadge rule={rule} />}
        </Stack>
      }
      description={searchHit.lastError && <RuleDescription lastError={searchHit.lastError} />}
      right={
        <EffectiveRuleInterval
          sequence={sequence}
          ruleInterval={searchHit.interval}
          onSequenceClick={onSequenceClick}
        />
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
