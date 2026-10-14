import { t } from '@grafana/i18n';

import { type RuleKind } from '../shared/analytics';

import { RuleActionMenuItem } from './RuleActionMenuItem';
import { trackRuleDuplicateStarted } from './analytics';
import { type ActionAvailability } from './ruleActionTypes';
import { ruleDuplicateUrl } from './ruleLinks';

interface DuplicateRuleMenuItemProps {
  kind: RuleKind;
  uid: string;
  availability: ActionAvailability;
}

/**
 * Duplicate menu item shared by the Alert and Recording menus. It is a plain link to the existing
 * creation flow prefilled from the source rule (`copyFrom`); the editor itself handles identity,
 * status and provisioning ownership of the copy.
 */
export function DuplicateRuleMenuItem({ kind, uid, availability }: DuplicateRuleMenuItemProps) {
  return (
    <RuleActionMenuItem
      availability={availability}
      label={t('alerting.gma-rule-list.actions.duplicate', 'Duplicate')}
      icon="copy"
      url={ruleDuplicateUrl(kind, uid)}
      onClick={() => trackRuleDuplicateStarted(kind)}
    />
  );
}
