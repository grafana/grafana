import React from 'react';
import { mount } from 'enzyme';
import { Menu } from './Menu';
import { MenuGroup } from './MenuGroup';
import { MenuItem } from './MenuItem';

describe('Menu', () => {
  it('renders items without error', () => {
    mount(
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

  it('renders correct contents', () => {
    const wrapper = mount(
      <div>
        <Menu header="mock header">
          <MenuGroup label="Group 1">
            <MenuItem label="item1" icon="history" active={true} />
            <MenuItem label="item2" icon="filter" active={true} />
          </MenuGroup>
        </Menu>
      </div>
    );
    expect(wrapper.contains('item1')).toBeTruthy();
    expect(wrapper.contains('Group 1')).toBeTruthy();
    expect(wrapper.contains('mock header')).toBeTruthy();
  });
});
