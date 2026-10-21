import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';

import { isActionShown, unavailableActionLabel } from './actionReasons';
import { type ActionAvailability } from './ruleActionTypes';

interface EditRuleButtonProps {
  uid: string;
  availability: ActionAvailability;
}

/** Hidden when unusable; while checking it is a disabled button, since a disabled link ignores pointer events. */
export function EditRuleButton({ uid, availability }: EditRuleButtonProps) {
  const label = t('alerting.gma-rule-list.actions.edit', 'Edit');

  if (!isActionShown(availability)) {
    return null;
  }

  if (!availability.available) {
    return (
      <Button
        size="sm"
        variant="secondary"
        fill="text"
        disabled
        tooltip={availability.reason}
        aria-label={unavailableActionLabel(label, availability.reason)}
      >
        {label}
      </Button>
    );
  }

  return (
    <LinkButton href={grafanaRulesNav.editLink(uid)} size="sm" variant="secondary" fill="text">
      {label}
    </LinkButton>
  );
}
