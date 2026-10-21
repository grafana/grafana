import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  hit: RecordingRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ hit, folderPath }: RecordingRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={hit.health} paused={hit.paused} />}
      title={
        <TextLink id={titleId} href={grafanaRulesNav.viewLink(hit.uid)} color="primary" inline={false}>
          {hit.title}
        </TextLink>
      }
      meta={[folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />]}
    />
  );
}
