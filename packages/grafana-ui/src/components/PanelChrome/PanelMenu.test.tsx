import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Menu } from '../Menu/Menu';

import { PanelMenu } from './PanelMenu';

it('keeps a long panel menu label accessible and actionable', async () => {
  const user = userEvent.setup();
  const onClick = jest.fn();
  const label =
    'Add to "Incident investigation: intermittent checkout latency across us-east, eu-west, and ap-south clusters"';

  render(
    <PanelMenu
      title="TestData random walk"
      menu={
        <Menu>
          <Menu.Item label={label} onClick={onClick} />
        </Menu>
      }
    />
  );

  await user.click(screen.getByRole('button', { name: 'Menu for panel TestData random walk' }));
  const menuItem = screen.getByRole('menuitem', { name: label });
  menuItem.focus();
  expect(menuItem).toHaveFocus();
  await user.click(menuItem);
  expect(onClick).toHaveBeenCalledTimes(1);
});
