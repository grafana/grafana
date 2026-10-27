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

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  searchHit: AlertRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Plugin or provisioning badge; absent while the full rule loads or when there is no badge. */
  badge?: ReactNode;
}

/** Presentation-only; missing state/health renders "unavailable", never healthy. */
export function AlertRuleRow({ searchHit, folderPath, badge }: AlertRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={searchHit.state} health={searchHit.health} paused={searchHit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
          <TextLink id={titleId} href={grafanaRulesNav.viewLink(searchHit.uid)} color="primary" inline={false}>
            {searchHit.title}
          </TextLink>
          {badge}
        </Stack>
      }
      description={
        (searchHit.lastError || searchHit.summary) && (
          <RuleDescription lastError={searchHit.lastError} summary={searchHit.summary} />
        )
      }
      right={searchHit.interval && <RuleInterval interval={searchHit.interval} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
          <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
        ),
        // parseSearchLabels guarantees labels is non-empty when present; RuleLabels handles the null case.
        searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
      ]}
    />
  );
}
