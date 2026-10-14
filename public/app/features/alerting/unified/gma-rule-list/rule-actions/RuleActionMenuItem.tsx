import { type ComponentProps } from 'react';

import { Menu, Tooltip } from '@grafana/ui';

import { unavailableActionLabel } from './actionReasons';
import { type ActionAvailability } from './ruleActionTypes';

type RuleActionMenuItemProps = ComponentProps<typeof Menu.Item> & {
  availability: ActionAvailability;
};

/**
 * A menu item that stays in the menu when the user cannot use it right now, disabled and
 * explaining why on hover and to assistive tech, so every user sees the same actions and only their state differs.
 */
export function RuleActionMenuItem({ availability, ...itemProps }: RuleActionMenuItemProps) {
  if (availability.available) {
    return <Menu.Item {...itemProps} />;
  }

  return (
    <Tooltip content={availability.reason ?? ''}>
      <Menu.Item {...itemProps} disabled ariaLabel={unavailableActionLabel(itemProps.label, availability.reason)} />
    </Tooltip>
  );
}
