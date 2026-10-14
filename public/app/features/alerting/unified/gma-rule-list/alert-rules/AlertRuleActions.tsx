import { t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { ruleEditUrl } from '../rule-actions/ruleLinks';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { refreshRuleLists } from '../rule-data/refreshRuleLists';
import { invalidateFullAlertRule, useFullAlertRuleState } from '../rule-data/ruleResourceLookups';

import { AlertRuleActionsMenu } from './AlertRuleActionsMenu';

interface AlertRuleActionsProps {
  ruleUid: string;
}

/**
 * Wires the shared full-rule enrichment state and the refresh path into the action menu, so the
 * page and its rows don't need to know how the menu decides ability/provenance or how a
 * mutation invalidates the affected caches - only that one happened.
 */
export function AlertRuleActions({ ruleUid }: AlertRuleActionsProps) {
  const resourceState = useFullAlertRuleState(ruleUid);
  const abilities = useRuleActionAbilities(resourceState);

  const onMutated = () => {
    invalidateFullAlertRule(ruleUid);
    refreshRuleLists('alert');
  };

  return (
    <Stack direction="row" gap={0} wrap="nowrap">
      {abilities.edit.available && (
        <LinkButton href={ruleEditUrl(ruleUid)} size="sm" variant="secondary" fill="text">
          {t('alerting.gma-rule-list.alert-rules.edit', 'Edit')}
        </LinkButton>
      )}
      <AlertRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} onMutated={onMutated} buttonSize="sm" />
    </Stack>
  );
}
