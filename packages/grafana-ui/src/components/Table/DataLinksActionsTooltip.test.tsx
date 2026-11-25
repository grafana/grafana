import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, type LinkModel, type ActionModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { DataLinksActionsTooltip } from './DataLinksActionsTooltip';

describe('DataLinksActionsTooltip', () => {
  const mockCoords = { clientX: 100, clientY: 100 };
  const mockLink: LinkModel = {
    href: 'http://link1.com',
    title: 'Data Link1',
    target: '_blank',
    onClick: jest.fn(),
    origin: { ref: { uid: 'test' } },
  };

  const mockAction: ActionModel = {
    title: 'Action1',
    onClick: jest.fn(),
    confirmation: jest.fn(),
    style: { backgroundColor: '#ff0000' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when there is only one link', () => {
    const { container } = render(<DataLinksActionsTooltip links={[mockLink]} actions={[]} coords={mockCoords} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render tooltip with multiple links', async () => {
    const multipleLinks = [mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com' }];
    render(<DataLinksActionsTooltip links={multipleLinks} coords={mockCoords} />);

    expect(screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).toBeInTheDocument();
    expect(await screen.findByText('Data Link1')).toBeInTheDocument();

    const link = screen.getByText('Data Link1');
    await userEvent.click(link);
    expect(mockLink.onClick).toHaveBeenCalledTimes(1);
  });

  it('should handle links click events', async () => {
    const mockLinks = [mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com' }];

    render(<DataLinksActionsTooltip links={mockLinks} coords={mockCoords} />);

    const link = screen.getByText('Data Link1');
    await userEvent.click(link);
    expect(mockLink.onClick).toHaveBeenCalledTimes(1);
  });

  describe('with the table refresh enabled', () => {
    const links = [mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com', target: '_self' as const }];
    const firstLink = () => screen.getByRole('menuitem', { name: 'Data Link1' });

    const clickIsDefaultPrevented = async (modifier?: string) => {
      let prevented: boolean | undefined;
      document.addEventListener('click', (event) => (prevented = event.defaultPrevented), { once: true });

      const user = userEvent.setup();
      if (modifier) {
        await user.keyboard(`{${modifier}>}`);
      }
      await user.click(firstLink());

      return prevented;
    };

    it('should render each link once, as a menu item with its url and target', () => {
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} tableRefreshEnabled />);

      const theme = createTheme();
      expect(screen.getByRole('menu')).toHaveStyle({
        padding: theme.spacing(theme.components.menu.padding),
        borderRadius: theme.shape.radius[theme.components.menu.borderRadius],
      });

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveAttribute('data-role', 'menuitem');
      expect(items[0]).toHaveAttribute('href', 'http://link1.com');
      expect(items[0]).toHaveAttribute('target', '_blank');
      expect(items[1]).toHaveAttribute('href', 'http://link2.com');
      expect(items[1]).toHaveAttribute('target', '_self');
    });

    it('should call the link onClick instead of navigating', async () => {
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} tableRefreshEnabled />);

      expect(await clickIsDefaultPrevented()).toBe(true);
      expect(mockLink.onClick).toHaveBeenCalledTimes(1);
    });

    it.each(['Control', 'Meta', 'Shift'])('should leave a %s click to the browser', async (modifier) => {
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} tableRefreshEnabled />);

      expect(await clickIsDefaultPrevented(modifier)).toBe(false);
      expect(mockLink.onClick).not.toHaveBeenCalled();
    });

    it('should navigate normally when the link has no onClick', async () => {
      const { onClick, ...plainLink } = mockLink;
      render(
        <DataLinksActionsTooltip
          links={[plainLink, { ...plainLink, title: 'Data Link2' }]}
          coords={mockCoords}
          tableRefreshEnabled
        />
      );

      expect(await clickIsDefaultPrevented()).toBe(false);
    });

    it('should call the link onClick once when activated with the space key', async () => {
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} tableRefreshEnabled />);

      firstLink().focus();
      await userEvent.keyboard(' ');

      expect(mockLink.onClick).toHaveBeenCalledTimes(1);
    });

    it('should keep actions as buttons that the keyboard can reach', async () => {
      render(<DataLinksActionsTooltip links={links} actions={[mockAction]} coords={mockCoords} tableRefreshEnabled />);

      firstLink().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: 'Data Link2' })).toHaveFocus();
      await userEvent.tab();

      const action = screen.getByRole('button', { name: 'Action1' });
      expect(action).toHaveFocus();
      expect(screen.getByRole('menu')).not.toContainElement(action);
    });

    it('should dismiss with Escape from a footer action', async () => {
      const onTooltipClose = jest.fn();
      render(
        <DataLinksActionsTooltip
          links={links}
          actions={[mockAction]}
          coords={mockCoords}
          tableRefreshEnabled
          onTooltipClose={onTooltipClose}
        />
      );

      firstLink().focus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'Action1' })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(onTooltipClose).toHaveBeenCalledTimes(1);
    });

    it('should keep the footer hint for a one-click link', () => {
      render(
        <DataLinksActionsTooltip
          links={[{ ...mockLink, oneClick: true }, links[1]]}
          coords={mockCoords}
          tableRefreshEnabled
        />
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText(/Click to open/)).toBeInTheDocument();
    });

    it('should keep the footer hint for a one-click action', () => {
      render(
        <DataLinksActionsTooltip
          links={links}
          actions={[{ ...mockAction, oneClick: true }]}
          coords={mockCoords}
          tableRefreshEnabled
        />
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText(/Click to/)).toBeInTheDocument();
    });
  });

  it('should not render menu items without the table refresh', () => {
    render(<DataLinksActionsTooltip links={[mockLink, { ...mockLink, title: 'Data Link2' }]} coords={mockCoords} />);

    expect(screen.getByRole('link', { name: 'Data Link1' })).not.toHaveAttribute('data-role');
  });

  it('should render when there is only one action', () => {
    const { container } = render(<DataLinksActionsTooltip links={[]} actions={[mockAction]} coords={mockCoords} />);
    expect(container).toBeInTheDocument();
  });

  it('should render tooltip with actions', () => {
    const mockActions = [mockAction, { ...mockAction, title: 'Action2' }];

    render(<DataLinksActionsTooltip links={[]} actions={mockActions} coords={mockCoords} />);

    expect(screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).toBeInTheDocument();

    // Action button should be rendered
    const actionButton = screen.getByText('Action1');
    expect(actionButton).toBeInTheDocument();
  });

  it('should call onTooltipClose when tooltip is dismissed', async () => {
    const onTooltipClose = jest.fn();
    render(
      <DataLinksActionsTooltip
        links={[mockLink, { ...mockLink, title: 'Data Link2', href: 'http://link2.com' }]}
        coords={mockCoords}
        onTooltipClose={onTooltipClose}
      />
    );

    // click outside the tooltip
    await userEvent.click(document.body);

    expect(onTooltipClose).toHaveBeenCalledTimes(1);
  });

  it('should apply viewport-constrained scroll styles to the tooltip wrapper', () => {
    const manyLinks = Array.from({ length: 20 }, (_, index) => ({
      ...mockLink,
      title: `Data Link ${index + 1}`,
      href: `http://link${index + 1}.com`,
    }));

    render(<DataLinksActionsTooltip links={manyLinks} coords={mockCoords} />);

    const tooltipWrapper = screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper);
    expect(tooltipWrapper).toHaveStyle({
      maxHeight: 'calc(100vh - 32px)',
      overflowX: 'hidden',
    });
  });

  it('should render custom value', () => {
    const customValue = <div data-testid="custom-value">Custom Value</div>;
    render(<DataLinksActionsTooltip links={[mockLink]} coords={mockCoords} value={customValue} />);

    expect(screen.getByTestId('custom-value')).toBeInTheDocument();
  });
});
