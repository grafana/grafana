import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { createReturnTo } from '../../hooks/useReturnTo';
import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  searchHit: RecordingRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
}

/** Presentation-only; missing health renders "unavailable", never recording. */
export function RecordingRuleRow({ searchHit, folderPath }: RecordingRuleRowProps) {
  const titleId = useId();
  const returnTo = createReturnTo();
  const href = `${grafanaRulesNav.viewLink(searchHit.uid)}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={searchHit.health} paused={searchHit.paused} />}
      title={
        <TextLink id={titleId} href={href} color="primary" inline={false}>
          {searchHit.title}
        </TextLink>
      }
      meta={[folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />]}
    />
  );
}
