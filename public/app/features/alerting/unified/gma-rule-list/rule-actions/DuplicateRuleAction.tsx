import { t } from '@grafana/i18n';

import { grafanaRulesNav } from '../../utils/navigation';
import { type RuleKind } from '../shared/ruleKind';

import { RuleActionMenuItem } from './RuleActionMenuItem';
import { trackRuleDuplicateStarted } from './analytics';
import { type ActionAvailability } from './ruleActionTypes';

interface DuplicateRuleMenuItemProps {
  kind: RuleKind;
  uid: string;
  availability: ActionAvailability;
  onConfirmFirst?: () => void;
}

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
      url={grafanaRulesNav.duplicateLink(uid, { recording: kind === 'recording' })}
      onClick={() => trackRuleDuplicateStarted(kind)}
    />
  );
}
