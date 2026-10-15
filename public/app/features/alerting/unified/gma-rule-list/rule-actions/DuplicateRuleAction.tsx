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
  /** Set for a provisioned or managed rule: the item asks for confirmation instead of navigating. */
  onConfirmFirst?: () => void;
}

/**
 * Duplicate menu item shared by the Alert and Recording menus. It is a plain link to the existing
 * creation flow prefilled from the source rule (`copyFrom`); the editor itself handles identity,
 * status and provisioning ownership of the copy. A provisioned or managed rule hands off to the
 * caller's confirmation modal first.
 */
export function DuplicateRuleMenuItem({ kind, uid, availability, onConfirmFirst }: DuplicateRuleMenuItemProps) {
  const label = t('alerting.gma-rule-list.actions.duplicate', 'Duplicate');

  if (onConfirmFirst) {
    return <RuleActionMenuItem availability={availability} label={label} icon="copy" onClick={onConfirmFirst} />;
  }

  return (
    <RuleActionMenuItem
      availability={availability}
      label={label}
      icon="copy"
      url={ruleDuplicateUrl(kind, uid)}
      onClick={() => trackRuleDuplicateStarted(kind)}
    />
  );
}
