import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Stack } from '@grafana/ui';

import { EditRuleButton } from '../rule-actions/EditRuleButton';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { AlertRuleActionsMenu } from './AlertRuleActionsMenu';

interface AlertRuleActionsProps {
  ruleUid: string;
  resourceState: RuleResourceState<AlertRule>;
}

/**
 * Wires the already-loaded full-rule state into the Edit button and action menu, so the page and
 * its rows don't need to know how they decide ability/provenance. A mutation refreshes the
 * affected queries through tags.
 */
export function AlertRuleActions({ ruleUid, resourceState }: AlertRuleActionsProps) {
  const abilities = useRuleActionAbilities(resourceState);

  return (
    <Stack direction="row" gap={0} wrap="nowrap">
      <EditRuleButton uid={ruleUid} availability={abilities.edit} />
      <AlertRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} buttonSize="sm" />
    </Stack>
  );
}
