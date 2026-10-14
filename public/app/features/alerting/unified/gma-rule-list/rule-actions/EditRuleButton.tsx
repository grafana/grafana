import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { type ActionAvailability } from './ruleActionTypes';
import { ruleEditUrl } from './ruleLinks';

interface EditRuleButtonProps {
  uid: string;
  availability: ActionAvailability;
}

/**
 * Edit is a plain link to the existing editor. When it is unavailable it becomes a disabled button
 * with the reason, because a disabled link ignores pointer events and so could not show a tooltip.
 */
export function EditRuleButton({ uid, availability }: EditRuleButtonProps) {
  const label = t('alerting.gma-rule-list.actions.edit', 'Edit');

  if (!availability.available) {
    return (
      <Button size="sm" variant="secondary" fill="text" disabled tooltip={availability.reason}>
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
