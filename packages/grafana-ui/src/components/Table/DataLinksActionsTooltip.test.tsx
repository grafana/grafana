import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  describe('data link menu', () => {
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
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} />);

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
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} />);

      expect(await clickIsDefaultPrevented()).toBe(true);
      expect(mockLink.onClick).toHaveBeenCalledTimes(1);
    });

    it.each(['Control', 'Meta', 'Shift'])('should leave a %s click to the browser', async (modifier) => {
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} />);

      expect(await clickIsDefaultPrevented(modifier)).toBe(false);
      expect(mockLink.onClick).not.toHaveBeenCalled();
    });

    it('should navigate normally when the link has no onClick', async () => {
      const { onClick, ...plainLink } = mockLink;
      render(
        <DataLinksActionsTooltip links={[plainLink, { ...plainLink, title: 'Data Link2' }]} coords={mockCoords} />
      );

      expect(await clickIsDefaultPrevented()).toBe(false);
    });

    it('should call the link onClick once when activated with the space key', async () => {
      render(<DataLinksActionsTooltip links={links} coords={mockCoords} />);

      firstLink().focus();
      await userEvent.keyboard(' ');

      expect(mockLink.onClick).toHaveBeenCalledTimes(1);
    });

    it('should keep actions as buttons that the keyboard can reach', async () => {
      render(<DataLinksActionsTooltip links={links} actions={[mockAction]} coords={mockCoords} />);

      firstLink().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: 'Data Link2' })).toHaveFocus();
      await userEvent.tab();

      const action = screen.getByRole('button', { name: 'Action1' });
      expect(action).toHaveFocus();
      expect(screen.getByRole('menu')).not.toContainElement(action);
    });

    it.each(['link', 'action'])('should dismiss once with Escape from a %s', async (target) => {
      const onTooltipClose = jest.fn();
      render(
        <DataLinksActionsTooltip
          links={links}
          actions={[mockAction]}
          coords={mockCoords}
          onTooltipClose={onTooltipClose}
        />
      );

      firstLink().focus();
      if (target === 'action') {
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'Action1' })).toHaveFocus();
      }
      await userEvent.keyboard('{Escape}');
      expect(onTooltipClose).toHaveBeenCalledTimes(1);
    });

    it('should keep the footer hint for a one-click link', () => {
      render(<DataLinksActionsTooltip links={[{ ...mockLink, oneClick: true }, links[1]]} coords={mockCoords} />);

      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
      expect(screen.getByText(/Click to open/)).toBeInTheDocument();
    });

    it('should keep the footer hint for a one-click action', () => {
      render(
        <DataLinksActionsTooltip links={links} actions={[{ ...mockAction, oneClick: true }]} coords={mockCoords} />
      );

      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
      expect(screen.getByText(/Click to/)).toBeInTheDocument();
    });
  });

  it('should focus the first menu item when opened', () => {
    render(<DataLinksActionsTooltip links={[mockLink, { ...mockLink, title: 'Data Link2' }]} coords={mockCoords} />);

    expect(screen.getByRole('menuitem', { name: 'Data Link1' })).toHaveFocus();
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

it('follows the clicked cell when its scroll container moves', async () => {
  const scroller = document.createElement('div');
  scroller.style.overflow = 'auto';
  const cell = document.createElement('div');
  scroller.appendChild(cell);
  document.body.appendChild(scroller);
  const rect = jest.spyOn(cell, 'getBoundingClientRect');
  const initialRect = {
    x: 100,
    y: 200,
    left: 100,
    top: 200,
    right: 150,
    bottom: 220,
    width: 50,
    height: 20,
    toJSON: () => ({}),
  };
  rect.mockReturnValue(initialRect);
  const width = jest.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
  const height = jest.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  try {
    const { unmount } = render(
      <DataLinksActionsTooltip
        links={[
          { title: 'First', href: '#first', target: '_self', origin: {} },
          { title: 'Second', href: '#second', target: '_self', origin: {} },
        ]}
        coords={{ clientX: 125, clientY: 210, contextElement: cell }}
      />
    );
    const tooltip = screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper);
    await waitFor(() => expect(tooltip).toHaveStyle({ transform: 'translate(125px, 210px)' }));
    rect.mockReturnValue({ ...initialRect, left: 80, top: 160 });
    fireEvent.scroll(scroller);
    await waitFor(() => expect(tooltip).toHaveStyle({ transform: 'translate(105px, 170px)' }));
    unmount();
  } finally {
    width.mockRestore();
    height.mockRestore();
    scroller.remove();
  }
});

it.each([
  { axis: 'left', direction: 1 },
  { axis: 'left', direction: -1 },
  { axis: 'top', direction: 1 },
  { axis: 'top', direction: -1 },
])('dismisses after more than 80px of scrolling on $axis in direction $direction', ({ axis, direction }) => {
  const cell = document.createElement('div');
  const scroller = document.createElement('div');
  scroller.appendChild(cell);
  document.body.appendChild(scroller);
  const initialRect = {
    x: 200,
    y: 200,
    left: 200,
    top: 200,
    right: 250,
    bottom: 220,
    width: 50,
    height: 20,
    toJSON: () => ({}),
  };
  const rect = jest.spyOn(cell, 'getBoundingClientRect').mockReturnValue(initialRect);
  const onTooltipClose = jest.fn();
  const { unmount } = render(
    <DataLinksActionsTooltip
      links={[{ title: 'First', href: '#first', target: '_self', origin: {} }]}
      coords={{ clientX: 225, clientY: 210, contextElement: cell }}
      onTooltipClose={onTooltipClose}
    />
  );
  expect(screen.getByRole('menuitem', { name: 'First' })).toBeInTheDocument();
  fireEvent.scroll(screen.getByRole('menu'));
  expect(onTooltipClose).not.toHaveBeenCalled();
  rect.mockReturnValue({ ...initialRect, [axis]: 200 + 80 * direction });
  fireEvent.scroll(window);
  expect(onTooltipClose).not.toHaveBeenCalled();
  rect.mockReturnValue({ ...initialRect, [axis]: 200 + 81 * direction });
  fireEvent.scroll(scroller);
  expect(onTooltipClose).toHaveBeenCalledTimes(1);
  fireEvent.scroll(scroller);
  expect(onTooltipClose).toHaveBeenCalledTimes(1);
  unmount();
  scroller.remove();
});
