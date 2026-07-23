import { useState } from 'react';
import * as React from 'react';

import { type IconName } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, type ButtonProps, Dropdown, Icon, Menu, Stack } from '@grafana/ui';

/** Interaction fired when a user picks an option from the assistant setup dropdown. */
export const ASSISTANT_SETUP_DROPDOWN_INTERACTION = 'assistant_setup_dropdown_option_selected';

type AssistantMenuItem = {
  label: string;
  description: string;
  onClick: () => void;
  icon?: IconName;
};

type Props = {
  /** The guided, assistant-driven action. */
  assistantItem: AssistantMenuItem;
  /** The manual action. */
  manualItem: AssistantMenuItem;
  /**
   * Identifies where the dropdown is rendered. Reported alongside the selected option so we can
   * track assistant vs. manual adoption per surface.
   */
  source: string;
  /** Props applied to the dropdown trigger button. */
  buttonProps?: Omit<ButtonProps, 'children'>;
  /** Content of the dropdown trigger button (the angle icon is appended automatically). */
  children: React.ReactNode;
};

/**
 * Renders a split button that offers a guided, assistant-driven setup alongside a manual one.
 * Callers are responsible for only rendering this when the assistant is available.
 */
export function AssistantSetupDropdown({
  assistantItem,
  manualItem,
  source,
  buttonProps,
  children,
}: Props): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: 'assistant' | 'manual', onClick: () => void) => {
    reportInteraction(ASSISTANT_SETUP_DROPDOWN_INTERACTION, { source, option });
    onClick();
  };

  const menu = (
    <Menu>
      <Menu.Item
        icon={assistantItem.icon ?? 'ai-sparkle'}
        label={assistantItem.label}
        description={assistantItem.description}
        onClick={() => handleSelect('assistant', assistantItem.onClick)}
      />
      <Menu.Item
        icon={manualItem.icon ?? 'list-ul'}
        label={manualItem.label}
        description={manualItem.description}
        onClick={() => handleSelect('manual', manualItem.onClick)}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-end" onVisibleChange={setIsOpen}>
      <Button {...buttonProps}>
        <Stack direction="row" alignItems="center" gap={1}>
          {children}
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Stack>
      </Button>
    </Dropdown>
  );
}
