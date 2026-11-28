import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Menu } from '../Menu/Menu';
import { Portal } from '../Portal/Portal';

import { WithContextMenu } from './WithContextMenu';

const renderMenuItems = () => <div data-testid="menu-item">Open me</div>;

describe('WithContextMenu', () => {
  it('opens the menu when openMenu is called with a synthetic mouse event (legacy click path)', async () => {
    const user = userEvent.setup();
    render(
      <WithContextMenu renderMenuItems={renderMenuItems}>
        {({ openMenu }) => (
          <button data-testid="trigger" onClick={openMenu}>
            click me
          </button>
        )}
      </WithContextMenu>
    );

    expect(screen.queryByTestId('menu-item')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('menu-item')).toBeInTheDocument();
  });

  it('opens the menu when openMenu is called with an explicit {x, y} (programmatic path)', async () => {
    const user = userEvent.setup();
    render(
      <WithContextMenu renderMenuItems={renderMenuItems}>
        {({ openMenu }) => (
          <button data-testid="trigger" onClick={() => openMenu({ x: 100, y: 200 })}>
            programmatic
          </button>
        )}
      </WithContextMenu>
    );

    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('menu-item')).toBeInTheDocument();
  });

  it('applies one density to every menu item', async () => {
    const user = userEvent.setup();
    render(
      <WithContextMenu size="sm" renderMenuItems={() => <Menu.Item label="Compact item" />}>
        {({ openMenu }) => <button onClick={() => openMenu({ x: 100, y: 200 })}>open compact menu</button>}
      </WithContextMenu>
    );

    await user.click(screen.getByRole('button', { name: 'open compact menu' }));
    expect(screen.getByRole('menuitem', { name: 'Compact item' })).toHaveStyle({
      padding: '4px 4px',
      minHeight: '24px',
    });
  });

  it('opens the menu anchored to a DOM element (keyboard activation path)', async () => {
    // Regression-protection for the "synthetic MouseEvent dispatch" anti-pattern:
    // openMenu must accept the focused element directly so callers don't have to
    // fabricate `new MouseEvent('click', { clientX, clientY })` from
    // `getBoundingClientRect()` to position the menu under the cursor.
    const user = userEvent.setup();
    render(
      <WithContextMenu renderMenuItems={renderMenuItems}>
        {({ openMenu }) => (
          <button
            data-testid="trigger"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                openMenu(e.currentTarget);
              }
            }}
          >
            keyboard
          </button>
        )}
      </WithContextMenu>
    );

    expect(screen.queryByTestId('menu-item')).not.toBeInTheDocument();
    screen.getByTestId('trigger').focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('menu-item')).toBeInTheDocument();
  });

  it('anchors the menu to the trigger element when a click carries no pointer position (keyboard activation of legacy onClick consumers)', async () => {
    const user = userEvent.setup();
    render(
      <WithContextMenu renderMenuItems={renderMenuItems}>
        {({ openMenu }) => (
          <button data-testid="trigger" onClick={openMenu}>
            keyboard click
          </button>
        )}
      </WithContextMenu>
    );

    const trigger = screen.getByTestId('trigger');
    jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      width: 50,
      height: 20,
      right: 150,
      bottom: 220,
      x: 100,
      y: 200,
      toJSON: () => {},
    } as DOMRect);

    // Enter on the focused button dispatches a click with `detail` 0 and no
    // pointer coordinates — without element anchoring the menu would be
    // positioned at the viewport origin.
    trigger.focus();
    await user.keyboard('{Enter}');

    // Anchored at the trigger rect's center (x: 100 + 25, y: 200 + 10),
    // with ContextMenu's own ±5px offset applied.
    expect(screen.getByRole('menu')).toHaveStyle({ left: '120px', top: '215px' });
  });

  // A Document Picture-in-Picture window (the Grafana Assistant pop-out) is another realm, as an iframe is: its
  // elements fail this window's `instanceof Element`, and its presses and size are its own.
  describe('in another window', () => {
    let iframe: HTMLIFrameElement;
    let otherWindow: Window & typeof globalThis;

    beforeEach(() => {
      iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const contentWindow = iframe.contentDocument?.defaultView;
      if (contentWindow == null) {
        throw new Error('jsdom gave the iframe no window');
      }
      otherWindow = contentWindow;
    });

    afterEach(() => {
      iframe.remove();
    });

    // Opens the menu from the trigger element itself, or from its click (one with no pointer position anchors there).
    function renderInOtherWindow(openWith: 'element' | 'click' = 'element') {
      const ui = () => (
        <Portal root={otherWindow.document.body}>
          <WithContextMenu renderMenuItems={renderMenuItems}>
            {({ openMenu }) => (
              <button
                data-testid="trigger"
                onClick={(e) => (openWith === 'element' ? openMenu(e.currentTarget) : openMenu(e))}
              >
                open
              </button>
            )}
          </WithContextMenu>
        </Portal>
      );
      const view = render(ui());
      // A Portal hands its element to the portals inside it, such as the menu's, from its second render.
      view.rerender(ui());
      return { ...view, trigger: within(otherWindow.document.body).getByTestId('trigger') };
    }

    function mockRects(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
      // Elements there use that window's prototypes.
      return jest.spyOn(otherWindow.HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => {},
      });
    }

    it.each(['element', 'click'] as const)(
      'anchors the menu to a trigger element from that window (%s)',
      (openWith) => {
        const rects = mockRects({ left: 100, top: 200, width: 50, height: 20 });
        const { trigger, unmount } = renderInOtherWindow(openWith);

        // a click() carries no pointer position, as a keyboard activation
        act(() => trigger.click());

        // The trigger's center (x: 100 + 25, y: 200 + 10), with ContextMenu's own 5px offset.
        expect(within(otherWindow.document.body).getByRole('menu')).toHaveStyle({ left: '120px', top: '215px' });

        rects.mockRestore();
        unmount();
      }
    );

    it('positions the menu by that window, not by how far this one is scrolled', () => {
      const scrollX = Object.getOwnPropertyDescriptor(window, 'scrollX');
      const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
      Object.defineProperty(window, 'scrollX', { value: 100, configurable: true });
      Object.defineProperty(window, 'scrollY', { value: 50, configurable: true });
      const rects = mockRects({ left: 100, top: 200, width: 50, height: 20 });
      const { trigger, unmount } = renderInOtherWindow('click');

      // from the keyboard: anchored at the trigger's center, as when this window isn't scrolled
      act(() => trigger.click());
      expect(within(otherWindow.document.body).getByRole('menu')).toHaveStyle({ left: '120px', top: '215px' });

      // from the pointer: at the press, less that window's scroll
      const press = new otherWindow.MouseEvent('click', { bubbles: true, detail: 1 });
      Object.defineProperty(press, 'pageX', { value: 30 });
      Object.defineProperty(press, 'pageY', { value: 40 });
      act(() => {
        trigger.dispatchEvent(press);
      });
      expect(within(otherWindow.document.body).getByRole('menu')).toHaveStyle({ left: '25px', top: '45px' });

      rects.mockRestore();
      unmount();
      Object.defineProperty(window, 'scrollX', scrollX!);
      Object.defineProperty(window, 'scrollY', scrollY!);
    });

    it('flips the menu at the edge of that window', () => {
      Object.defineProperty(otherWindow, 'innerWidth', { value: 300, configurable: true });
      const rects = mockRects({ left: 250, top: 100, width: 50, height: 20 });
      const { trigger, unmount } = renderInOtherWindow();

      act(() => trigger.click());

      // Anchored at x 275, a 50px menu passes the 300px window, so it opens to the left: 275 - 50 - 5.
      expect(within(otherWindow.document.body).getByRole('menu')).toHaveStyle({ left: '220px', top: '115px' });

      rects.mockRestore();
      unmount();
    });

    it('closes the menu on a press outside it in that window', () => {
      const { trigger, unmount } = renderInOtherWindow();
      act(() => trigger.click());
      expect(within(otherWindow.document.body).getByTestId('menu-item')).toBeInTheDocument();

      act(() => {
        otherWindow.document.body.dispatchEvent(new otherWindow.MouseEvent('mousedown', { bubbles: true }));
      });

      expect(within(otherWindow.document.body).queryByTestId('menu-item')).not.toBeInTheDocument();
      unmount();
    });

    it('closes the menu on a press, in that window, on a node this window made', () => {
      const { trigger, unmount } = renderInOtherWindow();
      act(() => trigger.click());
      // charts and editors draw with nodes the main window's document creates, then move them there
      const moved = otherWindow.document.body.appendChild(document.createElement('div'));

      act(() => {
        moved.dispatchEvent(new otherWindow.MouseEvent('mousedown', { bubbles: true }));
      });

      expect(within(otherWindow.document.body).queryByTestId('menu-item')).not.toBeInTheDocument();
      unmount();
    });
  });
});
