import { useState } from 'react';
import * as React from 'react';

import { type IconName } from '@grafana/data';
import { Button, type ButtonProps, Dropdown, Icon, Menu, Stack } from '@grafana/ui';

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
  buttonProps,
  children,
}: Props): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const menu = (
    <Menu>
      <Menu.Item
        icon={assistantItem.icon ?? 'ai-sparkle'}
        label={assistantItem.label}
        description={assistantItem.description}
        onClick={assistantItem.onClick}
      />
      <Menu.Item
        icon={manualItem.icon ?? 'list-ul'}
        label={manualItem.label}
        description={manualItem.description}
        onClick={manualItem.onClick}
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
