import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Menu } from '../Menu/Menu';

import { ContextMenu } from './ContextMenu';

it.each(['Tab', 'Shift+Tab', 'Escape'])('requests dismissal once on %s', async (key) => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  render(<ContextMenu x={0} y={0} onClose={onClose} renderMenuItems={() => <Menu.Item label="Action" />} />);
  expect(screen.getByRole('menuitem', { name: 'Action' })).toHaveFocus();
  if (key === 'Escape') {
    await user.keyboard('{Escape}');
  } else {
    await user.tab({ shift: key === 'Shift+Tab' });
  }
  expect(onClose).toHaveBeenCalledTimes(1);
});
