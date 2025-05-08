import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { MenuItem, MenuItemProps } from './MenuItem';

describe('MenuItem', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  const getMenuItem = (props?: Partial<MenuItemProps>) => (
    <MenuItem ariaLabel={selectors.components.Menu.MenuItem('Test')} label="item1" icon="history" {...props} />
  );

  it('renders correct element type', () => {
    const { rerender } = render(getMenuItem({ onClick: jest.fn() }));

    expect(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).nodeName).toBe('BUTTON');

    rerender(getMenuItem({ url: 'test' }));

    expect(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).nodeName).toBe('A');
  });

  it('calls onClick when item is clicked', async () => {
    const onClick = jest.fn();

    render(getMenuItem({ onClick }));

    await user.click(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')));

    expect(onClick).toHaveBeenCalled();
  });

  it('renders and opens subMenu correctly', async () => {
    const childItems = [
      <MenuItem key="subitem1" label="subitem1" icon="history" />,
      <MenuItem key="subitem2" label="subitem2" icon="apps" />,
    ];

    render(getMenuItem({ childItems }));

    expect(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).nodeName).toBe('DIV');
    expect(screen.getByTestId(selectors.components.Menu.SubMenu.icon)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Menu.SubMenu.container)).not.toBeInTheDocument();

    await user.hover(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')));

    const subMenuContainer = await screen.findByTestId(selectors.components.Menu.SubMenu.container);

    expect(subMenuContainer).toBeInTheDocument();
    expect(subMenuContainer.firstChild?.childNodes.length).toBe(2);
  });

  it('renders disabled subMenu correctly', async () => {
    const childItems = [
      <MenuItem key="subitem1" label="subitem1" icon="history" />,
      <MenuItem key="subitem2" label="subitem2" icon="apps" />,
    ];

    render(getMenuItem({ childItems, disabled: true }));

    await user.hover(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')));

    const subMenuContainer = screen.queryByLabelText(selectors.components.Menu.SubMenu.container);
    expect(subMenuContainer).not.toBeInTheDocument();
  });

  it('opens subMenu on ArrowRight', async () => {
    const childItems = [
      <MenuItem key="subitem1" label="subitem1" icon="history" />,
      <MenuItem key="subitem2" label="subitem2" icon="apps" />,
    ];

    render(getMenuItem({ childItems }));

    expect(screen.queryByTestId(selectors.components.Menu.SubMenu.container)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(selectors.components.Menu.MenuItem('Test')), '{ArrowRight}');

    expect(await screen.findByTestId(selectors.components.Menu.SubMenu.container)).toBeInTheDocument();
  });

  it('renders with role="link" when URL is passed', async () => {
    render(<MenuItem label="URL Item" url="/some-url" />);
    expect(screen.getByRole('link', { name: 'URL Item' })).toBeInTheDocument();
  });

  it('renders with expected role when URL and role are passed', async () => {
    render(<MenuItem label="URL Item" url="/some-url" role="menuitem" />);
    expect(screen.getByRole('menuitem', { name: 'URL Item' })).toBeInTheDocument();
  });

  it('renders extra component if provided', async () => {
    render(<MenuItem label="main label" component={() => <p>extra content</p>} />);
    expect(screen.getByText('main label')).toBeInTheDocument();
    expect(screen.getByText('extra content')).toBeInTheDocument();
  });
});
