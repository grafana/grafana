import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Menu } from './Menu';
import { MenuGroup } from './MenuGroup';
import { MenuItem } from './MenuItem';

describe('Menu', () => {
  it('renders items without error', () => {
    expect(() => {
      render(
        <Menu ariaLabel={selectors.components.Menu.MenuComponent('Test')} header="mock header">
          <MenuGroup ariaLabel={selectors.components.Menu.MenuGroup('Test')} label="Group 1">
            <MenuItem
              ariaLabel={selectors.components.Menu.MenuItem('Test')}
              label="item1"
              icon="history"
              active={true}
            />
            <MenuItem
              ariaLabel={selectors.components.Menu.MenuItem('Test')}
              label="item2"
              icon="filter"
              active={true}
            />
          </MenuGroup>
        </Menu>
      );
    });
  });

  it('renders correct contents', () => {
    render(
      <Menu ariaLabel={selectors.components.Menu.MenuComponent('Test')} header="mock header">
        <MenuGroup ariaLabel={selectors.components.Menu.MenuGroup('Test')} label="Group 1">
          <MenuItem ariaLabel={selectors.components.Menu.MenuItem('Test')} label="item1" icon="history" active={true} />
          <MenuItem ariaLabel={selectors.components.Menu.MenuItem('Test')} label="item2" icon="filter" active={true} />
        </MenuGroup>
      </Menu>
    );
    expect(screen.getByLabelText(selectors.components.Menu.MenuComponent('Test'))).toBeInTheDocument();
    expect(screen.getByLabelText(selectors.components.Menu.MenuGroup('Test'))).toBeInTheDocument();
    expect(screen.getAllByLabelText(selectors.components.Menu.MenuItem('Test'))).toHaveLength(2);
  });
});

it('applies compact density to grouped menu items while allowing an item override', () => {
  render(
    <Menu size="sm">
      <MenuGroup label="Actions">
        <MenuItem label="Compact" />
        <MenuItem label="Regular" size="md" />
      </MenuGroup>
    </Menu>
  );

  expect(screen.getByRole('menuitem', { name: 'Compact' })).toHaveStyle({
    fontSize: createTheme().typography.bodySmall.fontSize,
    padding: '4px 4px',
    minHeight: '24px',
  });
  expect(screen.getByRole('menuitem', { name: 'Regular' })).toHaveStyle({
    fontSize: createTheme().typography.body.fontSize,
    padding: '4px 12px',
    minHeight: '32px',
  });
});

it('keeps replacement items reachable by Tab without stealing focus', async () => {
  const user = userEvent.setup();
  const renderMenu = (key: string) => (
    <>
      <button>Before menu</button>
      <Menu autoFocus={false}>
        <MenuItem key={key} label="Open dashboard" url="#dashboard" onClick={() => {}} />
      </Menu>
    </>
  );
  const { rerender } = render(renderMenu('initial'));
  await user.tab();
  expect(screen.getByRole('button', { name: 'Before menu' })).toHaveFocus();

  rerender(renderMenu('replacement'));
  expect(screen.getByRole('button', { name: 'Before menu' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('menuitem', { name: 'Open dashboard' })).toHaveFocus();
});

it('keeps a tab stop when the focused item is removed', async () => {
  const user = userEvent.setup();
  const renderMenu = (labels: string[]) => (
    <Menu autoFocus={false}>
      {labels.map((label) => (
        <MenuItem key={label} label={label} />
      ))}
    </Menu>
  );
  const { rerender } = render(renderMenu(['First', 'Second', 'Third']));

  await user.tab();
  await user.keyboard('{End}');
  expect(screen.getByRole('menuitem', { name: 'Third' })).toHaveFocus();

  rerender(renderMenu(['First']));

  expect(screen.getByRole('menuitem', { name: 'First' })).toHaveAttribute('tabindex', '0');
});

it('keeps the current item tabbable when ArrowLeft has no submenu to close', async () => {
  const user = userEvent.setup();
  render(
    <Menu autoFocus={false}>
      <MenuItem label="First" />
    </Menu>
  );

  await user.tab();
  const item = screen.getByRole('menuitem', { name: 'First' });
  expect(item).toHaveFocus();

  await user.keyboard('{ArrowLeft}');

  expect(item).toHaveAttribute('tabindex', '0');
});
