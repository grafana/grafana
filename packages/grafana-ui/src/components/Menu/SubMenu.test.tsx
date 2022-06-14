import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { MenuItem } from './MenuItem';
import { SubMenu } from './SubMenu';

describe('SubMenu', () => {
  it('renders and opens SubMenu', async () => {
    const items = [
      <MenuItem key="subitem1" label="subitem1" icon="history" />,
      <MenuItem key="subitem2" label="subitem2" icon="apps" />,
    ];

    render(
      <SubMenu items={items} isOpen={true} openedWithArrow={false} setOpenedWithArrow={jest.fn()} close={jest.fn()} />
    );

    expect(screen.getByLabelText(selectors.components.Menu.SubMenu.icon)).toBeInTheDocument();

    const subMenuContainer = await screen.findByLabelText(selectors.components.Menu.SubMenu.container);

    expect(subMenuContainer).toBeInTheDocument();
    expect(subMenuContainer.firstChild?.childNodes.length).toBe(2);
  });
});
