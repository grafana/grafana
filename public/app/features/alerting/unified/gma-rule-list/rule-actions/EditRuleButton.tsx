import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { unavailableActionLabel } from './actionReasons';
import { type ActionAvailability } from './ruleActionTypes';
import { ruleEditUrl } from './ruleLinks';

interface EditRuleButtonProps {
  uid: string;
  availability: ActionAvailability;
}

/** Unavailable Edit is a disabled button: a disabled link ignores pointer events, so no tooltip. */
export function EditRuleButton({ uid, availability }: EditRuleButtonProps) {
  const label = t('alerting.gma-rule-list.actions.edit', 'Edit');

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
    <LinkButton href={ruleEditUrl(uid)} size="sm" variant="secondary" fill="text">
      {label}
    </LinkButton>
  );
}
