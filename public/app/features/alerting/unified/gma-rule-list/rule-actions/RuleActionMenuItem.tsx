import { type ComponentProps } from 'react';

import { Menu, Tooltip } from '@grafana/ui';

import { unavailableActionLabel } from './actionReasons';
import { type ActionAvailability } from './ruleActionTypes';

type RuleActionMenuItemProps = ComponentProps<typeof Menu.Item> & {
  availability: ActionAvailability;
};

/** Menu sections use it to drop dividers that would be left with nothing next to them. */
export function isActionShown(availability: ActionAvailability): boolean {
  return availability.available || Boolean(availability.checking);
}

/** Unusable actions are left out, except while checking: then the item is disabled so the menu doesn't change shape. */
export function RuleActionMenuItem({ availability, ...itemProps }: RuleActionMenuItemProps) {
  if (availability.available) {
    return <Menu.Item {...itemProps} />;
  }

  if (!isActionShown(availability)) {
    return null;
  }

  return (
    <Tooltip content={availability.reason ?? ''}>
      <Menu.Item {...itemProps} disabled ariaLabel={unavailableActionLabel(itemProps.label, availability.reason)} />
    </Tooltip>
  );
}
