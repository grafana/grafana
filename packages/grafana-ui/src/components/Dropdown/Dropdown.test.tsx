import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Button } from '../Button';
import { Menu } from '../Menu/Menu';

import { Dropdown } from './Dropdown';

describe('Dropdown', () => {
  it('supports buttons with tooltips', async () => {
    const menu = (
      <Menu>
        <Menu.Item label="View settings" />
      </Menu>
    );

    render(
      <Dropdown overlay={menu}>
        <Button tooltip="Tooltip content">Open me</Button>
      </Dropdown>
    );

    const button = screen.getByRole('button', { name: 'Open me' });

    await userEvent.hover(button);
    expect(await screen.findByText('Tooltip content')).toBeVisible(); // tooltip appears on a delay

    await userEvent.click(button);
    expect(screen.queryByText('View settings')).toBeVisible();
  });
});
