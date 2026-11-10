import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { Button } from '../Button/Button';
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

  it('sets aria-expanded on the trigger button', async () => {
    const menu = (
      <Menu>
        <Menu.Item label="View settings" />
      </Menu>
    );

    render(
      <Dropdown overlay={menu}>
        <Button>Toggle</Button>
      </Dropdown>
    );

    const button = screen.getByRole('button', { name: 'Toggle' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('preserves an object ref on the trigger', async () => {
    const menu = (
      <Menu>
        <Menu.Item label="View settings" />
      </Menu>
    );
    const ref = createRef<HTMLButtonElement>();

    const { unmount } = render(
      <Dropdown overlay={menu}>
        <Button ref={ref}>Open me</Button>
      </Dropdown>
    );

    const button = screen.getByRole('button', { name: 'Open me' });
    expect(ref.current).toBe(button);

    await userEvent.click(button);
    expect(screen.queryByText('View settings')).toBeVisible();

    unmount();
    expect(ref.current).toBeNull();
  });

  it('preserves a callback ref on the trigger', () => {
    const menu = (
      <Menu>
        <Menu.Item label="View settings" />
      </Menu>
    );
    const ref = jest.fn();

    const { unmount } = render(
      <Dropdown overlay={menu}>
        <Button ref={ref}>Open me</Button>
      </Dropdown>
    );

    expect(ref).toHaveBeenLastCalledWith(screen.getByRole('button', { name: 'Open me' }));

    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });
});
