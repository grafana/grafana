import React from 'react';
import { render, screen } from '@testing-library/react';
import { Menu } from './Menu';
import { MenuGroup } from './MenuGroup';
import { MenuItem } from './MenuItem';

describe('Menu', () => {
  it('renders items without error', () => {
    expect(() => {
      render(
        <Menu header="mock header">
          <MenuGroup label="Group 1">
            <MenuItem label="item1" icon="history" active={true} />
            <MenuItem label="item2" icon="filter" active={true} />
          </MenuGroup>
        </Menu>
      );
    });
  });

  it('renders correct contents', () => {
    render(
      <Menu data-testid="my-test-id" header="mock header">
        <MenuGroup data-testid="my-test-id" label="Group 1">
          <MenuItem data-testid="my-test-id" label="item1" icon="history" active={true} />
          <MenuItem data-testid="my-test-id" label="item2" icon="filter" active={true} />
        </MenuGroup>
      </Menu>
    );
    expect(screen.getByTestId('my-test-id')).toHaveTextContent('item1');
    expect(screen.getByTestId('my-test-id')).toHaveTextContent('Group 1');
    expect(screen.getByTestId('my-test-id')).toHaveTextContent('mock header');
  });
});
