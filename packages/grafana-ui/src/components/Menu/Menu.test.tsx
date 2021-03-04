import React from 'react';
import { render, screen } from '@testing-library/react';
import { Menu } from './Menu';
import { MenuGroup } from './MenuGroup';
import { MenuItem } from './MenuItem';

describe('Menu', () => {
  it('renders items without error', () => {
    expect(() => {
      render(
        <div>
          <Menu header="mock header">
            <MenuGroup label="Group 1">
              <MenuItem label="item1" icon="history" active={true} />
              <MenuItem label="item2" icon="filter" active={true} />
            </MenuGroup>
          </Menu>
        </div>
      );
    });
  });

  it('renders correct contents', () => {
    render(
      <div>
        <Menu header="mock header">
          <MenuGroup label="Group 1">
            <MenuItem label="item1" icon="history" active={true} />
            <MenuItem label="item2" icon="filter" active={true} />
          </MenuGroup>
        </Menu>
      </div>
    );
    expect(screen.getByLabelText('Group 1')).toBeInTheDocument();
    expect(screen.getByLabelText('item1')).toBeInTheDocument();
  });
});
