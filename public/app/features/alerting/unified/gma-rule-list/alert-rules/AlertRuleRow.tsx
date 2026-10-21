import { useId } from 'react';

import { TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  hit: AlertRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
}

/** Presentation-only; missing state/health renders "unavailable", never healthy. */
export function AlertRuleRow({ hit, folderPath }: AlertRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={hit.state} health={hit.health} paused={hit.paused} />}
      title={
        <TextLink id={titleId} href={grafanaRulesNav.viewLink(hit.uid)} color="primary" inline={false}>
          {hit.title}
        </TextLink>
      }
      meta={[folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />]}
    />
  );
}
