import { RecordingRuleActionsMenu } from '../actions/RecordingRuleActionsMenu';
import { invalidateFullRecordingRule, useFullRecordingRuleState } from '../shared/caches';
import { refreshRuleLists } from '../shared/refreshRuleLists';

interface RecordingRuleActionsProps {
  ruleUid: string;
}

export function RecordingRuleActions({ ruleUid }: RecordingRuleActionsProps) {
  const resourceState = useFullRecordingRuleState(ruleUid);

  const onMutated = () => {
    invalidateFullRecordingRule(ruleUid);
    refreshRuleLists('recording');
  };

  return (
    <RecordingRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} onMutated={onMutated} buttonSize="sm" />
  );
}
