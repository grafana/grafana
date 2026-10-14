import { t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { ruleEditUrl } from '../rule-actions/ruleLinks';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { useFullAlertRuleState } from '../rule-data/ruleResourceLookups';

import { AlertRuleActionsMenu } from './AlertRuleActionsMenu';

interface AlertRuleActionsProps {
  ruleUid: string;
}

/**
 * Wires the full-rule lookup into the action menu, so the page and its rows don't need to know how
 * the menu decides ability/provenance. A mutation refreshes the affected queries through tags.
 */
export function AlertRuleActions({ ruleUid }: AlertRuleActionsProps) {
  const resourceState = useFullAlertRuleState(ruleUid);
  const abilities = useRuleActionAbilities(resourceState);

  return (
    <Stack direction="row" gap={0} wrap="nowrap">
      {abilities.edit.available && (
        <LinkButton href={ruleEditUrl(ruleUid)} size="sm" variant="secondary" fill="text">
          {t('alerting.gma-rule-list.alert-rules.edit', 'Edit')}
        </LinkButton>
      )}
      <AlertRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} buttonSize="sm" />
    </Stack>
  );
}
