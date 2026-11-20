import { css } from '@emotion/css';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { MenuItem, type MenuItemProps } from './MenuItem';

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

  it('announces subMenu parents to screen readers via aria-haspopup and aria-expanded', async () => {
    const childItems = [
      <MenuItem key="subitem1" label="subitem1" icon="history" />,
      <MenuItem key="subitem2" label="subitem2" icon="apps" />,
    ];

    render(getMenuItem({ childItems }));

    const item = screen.getByLabelText(selectors.components.Menu.MenuItem('Test'));
    expect(item).toHaveAttribute('aria-haspopup', 'menu');
    expect(item).toHaveAttribute('aria-expanded', 'false');

    await user.hover(item);

    expect(item).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not set aria-haspopup or aria-expanded on items without a subMenu', () => {
    render(getMenuItem({ onClick: jest.fn() }));

    const item = screen.getByLabelText(selectors.components.Menu.MenuItem('Test'));
    expect(item).not.toHaveAttribute('aria-haspopup');
    expect(item).not.toHaveAttribute('aria-expanded');
  });

  it('renders with role="menuitem" when URL is passed (default for menu semantics)', () => {
    render(<MenuItem label="URL Item" url="/some-url" />);
    expect(screen.getByRole('menuitem', { name: 'URL Item' })).toBeInTheDocument();
  });

  it('renders with expected role when URL and role are passed', async () => {
    render(<MenuItem label="URL Item" url="/some-url" role="menuitem" />);
    expect(screen.getByRole('menuitem', { name: 'URL Item' })).toBeInTheDocument();
  });

  it('keeps menu semantics while rendering the link variant with menu text color', () => {
    render(<MenuItem label="External link" url="https://example.com" variant="link" />);

    const menuTextColor = createTheme().colors.text.primary;
    expect(screen.getByRole('menuitem', { name: 'External link' })).toHaveStyle({ color: menuTextColor });
    expect(screen.getByText('External link')).toHaveStyle({ color: menuTextColor });
  });

  it('renders extra component if provided', async () => {
    render(<MenuItem label="main label" component={() => <p>extra content</p>} />);
    expect(screen.getByText('main label')).toBeInTheDocument();
    expect(screen.getByText('extra content')).toBeInTheDocument();
  });

  it('forwards data attributes to the menuitem element', () => {
    render(<MenuItem label="Item" data-analytics-id="menu_item_clicked" />);

    expect(screen.getByRole('menuitem', { name: 'Item' })).toHaveAttribute('data-analytics-id', 'menu_item_clicked');
  });

  it('keeps rendering testId as data-testid alongside other data attributes', () => {
    render(<MenuItem label="Item" testId="menu-item" data-analytics-id="menu_item_clicked" />);

    const item = screen.getByTestId('menu-item');
    expect(item).toHaveAttribute('role', 'menuitem');
    expect(item).toHaveAttribute('data-analytics-id', 'menu_item_clicked');
  });

  it('does not forward props that are not data attributes to the DOM', () => {
    const itemWithExtraFields = { label: 'Item', value: 'some-value', 'data-analytics-id': 'menu_item_clicked' };
    render(<MenuItem {...itemWithExtraFields} />);

    const item = screen.getByRole('menuitem', { name: 'Item' });
    expect(item).toHaveAttribute('data-analytics-id', 'menu_item_clicked');
    expect(item).not.toHaveAttribute('value');
  });

  it('does not let data attributes override the internal data-role used by Menu', () => {
    render(<MenuItem label="Item" data-role="custom" />);

    expect(screen.getByRole('menuitem', { name: 'Item' })).toHaveAttribute('data-role', 'menuitem');
  });

  it('allows custom styles to override the default item styles', () => {
    render(<MenuItem label="Item" className={css({ padding: '12px 40px 12px 12px' })} />);

    expect(screen.getByRole('menuitem', { name: 'Item' })).toHaveStyle({
      paddingTop: '12px',
      paddingRight: '40px',
      paddingBottom: '12px',
      paddingLeft: '12px',
    });
  });

  it('activates link MenuItem with Space key', async () => {
    const onClick = jest.fn((e: React.MouseEvent) => e.preventDefault());
    render(<MenuItem label="Link Item" url="/some-url" onClick={onClick} />);

    const item = screen.getByRole('menuitem', { name: 'Link Item' });
    await user.type(item, ' ');

    expect(onClick).toHaveBeenCalled();
  });

  describe('iconColor', () => {
    it('passes the color string directly to the icon style', () => {
      render(getMenuItem({ iconColor: '#B877D9' }));
      const icon = screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).querySelector('svg');
      expect(icon).toHaveStyle({ color: '#B877D9' });
    });

    it('does not apply iconColor when destructive is true', () => {
      render(getMenuItem({ iconColor: '#B877D9', destructive: true }));
      const icon = screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).querySelector('svg');
      expect(icon).not.toHaveStyle({ color: '#B877D9' });
    });

    it('does not apply iconColor when disabled is true', () => {
      render(getMenuItem({ iconColor: '#B877D9', disabled: true }));
      const icon = screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).querySelector('svg');
      expect(icon).not.toHaveStyle({ color: '#B877D9' });
    });

    it('does not apply inline color style when iconColor is not set', () => {
      render(getMenuItem());
      const icon = screen.getByLabelText(selectors.components.Menu.MenuItem('Test')).querySelector('svg');
      expect(icon).not.toHaveAttribute('style');
    });
  });
});
