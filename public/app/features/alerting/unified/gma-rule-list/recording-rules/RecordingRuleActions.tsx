import { Stack } from '@grafana/ui';

import { EditRuleButton } from '../rule-actions/EditRuleButton';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { useFullRecordingRuleState } from '../rule-data/ruleResourceLookups';

import { RecordingRuleActionsMenu } from './RecordingRuleActionsMenu';

interface RecordingRuleActionsProps {
  ruleUid: string;
}

export function RecordingRuleActions({ ruleUid }: RecordingRuleActionsProps) {
  const resourceState = useFullRecordingRuleState(ruleUid);
  const abilities = useRuleActionAbilities(resourceState);

  return (
    <Stack direction="row" gap={0} wrap="nowrap">
      <EditRuleButton uid={ruleUid} availability={abilities.edit} />
      <RecordingRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} buttonSize="sm" />
    </Stack>
  );
}
