import { AlertRuleActionsMenu } from '../actions/AlertRuleActionsMenu';
import { invalidateFullAlertRule, useFullAlertRuleState } from '../shared/caches';
import { refreshRuleLists } from '../shared/refreshRuleLists';

interface AlertRuleActionsProps {
  ruleUid: string;
}

/**
 * Wires the shared full-rule enrichment state and the refresh path into FE-prereq's action
 * menu, so the page and its rows don't need to know how the menu decides ability/provenance or
 * how a mutation invalidates the affected caches - only that one happened.
 */
export function AlertRuleActions({ ruleUid }: AlertRuleActionsProps) {
  const resourceState = useFullAlertRuleState(ruleUid);

  const onMutated = () => {
    invalidateFullAlertRule(ruleUid);
    refreshRuleLists('alert');
  };

  return <AlertRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} onMutated={onMutated} buttonSize="sm" />;
}
