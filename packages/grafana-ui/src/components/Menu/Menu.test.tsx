import { render, screen } from '@testing-library/react';
import React from 'react';

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
