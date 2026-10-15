import { type ComponentProps } from 'react';

import { Menu, Tooltip } from '@grafana/ui';

import { unavailableActionLabel } from './actionReasons';
import { type ActionAvailability } from './ruleActionTypes';

type RuleActionMenuItemProps = ComponentProps<typeof Menu.Item> & {
  availability: ActionAvailability;
};

/** Stays in the menu when unusable, disabled with the reason on hover and for assistive tech. */
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
