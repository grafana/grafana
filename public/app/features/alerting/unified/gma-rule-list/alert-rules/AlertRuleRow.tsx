import { type ReactNode, useId } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Stack, TextLink } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleInstanceCounts } from '../rule-row/RuleInstanceCounts';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleOriginBadge } from '../rule-row/RuleOriginBadge';
import { RuleRouting } from '../rule-row/RuleRouting';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';
import { EffectiveRuleInterval } from '../rule-sequences/EffectiveRuleInterval';
import { type RuleSequenceMembership } from '../rule-sequences/ruleSequenceMembership';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  searchHit: AlertRuleSearchHit;
  /** Absent while the folder path loads or when its lookup failed. */
  folderPath?: string[];
  /** Full rule resource; absent while loading or when the fetch failed. */
  rule?: AlertRule;
  /** `null`: not in a sequence. Absent while loading or when the lookup failed. */
  sequence?: RuleSequenceMembership | null;
  onSequenceClick: () => void;
  /** Edit button, More dropdown, or a loading skeleton — provided by AlertRuleListEntry. */
  actions?: ReactNode;
}

export function AlertRuleRow({ searchHit, folderPath, rule, sequence, onSequenceClick, actions }: AlertRuleRowProps) {
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
          {rule && <RuleOriginBadge rule={rule} />}
        </Stack>
      }
      description={
        (searchHit.lastError || searchHit.summary) && (
          <RuleDescription lastError={searchHit.lastError} summary={searchHit.summary} />
        )
      }
      right={
        <Stack alignItems="center" gap={1.5} wrap={false}>
          <EffectiveRuleInterval
            sequence={sequence}
            ruleInterval={searchHit.interval}
            onSequenceClick={onSequenceClick}
          />
          {actions}
        </Stack>
      }
      meta={[
        <RuleInstanceCounts key="counts" searchHit={searchHit} />,
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        // parseSearchLabels guarantees labels is non-empty when present; RuleLabels handles the null case.
        searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
        searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
          <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
        ),
        <RuleRouting key="routing" searchHit={searchHit} />,
      ]}
    />
  );
}
