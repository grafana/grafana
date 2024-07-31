import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { MenuItem } from './MenuItem';
import { SubMenu } from './SubMenu';

describe('SubMenu', () => {
  it('renders and opens SubMenu', async () => {
    const items = [
      <MenuItem key="subitem1" label="subitem1" icon="history" />,
      <MenuItem key="subitem2" label="subitem2" icon="apps" />,
    ];

    render(<SubMenu items={items} isOpen={true} close={jest.fn()} />);

    expect(screen.getByTestId(selectors.components.Menu.SubMenu.icon)).toBeInTheDocument();

    const subMenuContainer = await screen.findByTestId(selectors.components.Menu.SubMenu.container);

    expect(subMenuContainer).toBeInTheDocument();
    expect(subMenuContainer.firstChild?.childNodes.length).toBe(2);
  });
});
