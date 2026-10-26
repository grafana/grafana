import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { labelsSize } from '../../utils/labels';
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
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, folderPath }: RecordingRuleRowProps) {
  const titleId = useId();
  const href = grafanaRulesNav.viewLink(searchHit.uid, { includeReturnTo: true });

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={searchHit.health} paused={searchHit.paused} />}
      title={
        <TextLink id={titleId} href={href} color="primary" inline={false}>
          {searchHit.title}
        </TextLink>
      }
      description={searchHit.lastError && <RuleDescription lastError={searchHit.lastError} />}
      right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        searchHit.metric && searchHit.targetDatasourceUID && (
          <RuleRecordedMetric
            key="metric"
            metric={searchHit.metric}
            targetDatasourceUID={searchHit.targetDatasourceUID}
          />
        ),
        searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
          <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
        ),
        searchHit.labels && labelsSize(searchHit.labels) > 0 && <RuleLabels key="labels" labels={searchHit.labels} />,
      ]}
    />
  );
}
