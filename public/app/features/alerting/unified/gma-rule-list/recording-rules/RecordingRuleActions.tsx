import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Stack } from '@grafana/ui';

import { EditRuleButton } from '../rule-actions/EditRuleButton';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { RecordingRuleActionsMenu } from './RecordingRuleActionsMenu';

interface RecordingRuleActionsProps {
  ruleUid: string;
  resourceState: RuleResourceState<RecordingRule>;
}

export function RecordingRuleActions({ ruleUid, resourceState }: RecordingRuleActionsProps) {
  const abilities = useRuleActionAbilities(resourceState);

  return (
    <Stack direction="row" gap={0} wrap="nowrap">
      <EditRuleButton uid={ruleUid} availability={abilities.edit} />
      <RecordingRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} />
    </Stack>
  );
}
