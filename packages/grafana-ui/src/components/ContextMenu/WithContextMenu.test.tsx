import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MenuItem, MenuGroup } from '@grafana/ui';

import { WithContextMenu } from './WithContextMenu';

// Mock getBoundingClientRect for keyboard event tests
const mockGetBoundingClientRect = (x = 100, y = 200, width = 50, height = 50) => {
  return jest.fn(() => ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    bottom: y + height,
    right: x + width,
    toJSON: jest.fn(),
  }));
};

describe('WithContextMenu', () => {
  it('supports mouse events', async () => {
    render(
      <WithContextMenu
        renderMenuItems={() => (
          <>
            <MenuGroup>
              <MenuItem label="Item 1" />
              <MenuItem label="Item 2" />
            </MenuGroup>
          </>
        )}
      >
        {({ openMenu }) => (
          <div data-testid="context-menu-target" onClick={openMenu}>
            Click me
          </div>
        )}
      </WithContextMenu>
    );

    expect(screen.getByTestId('context-menu-target')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('context-menu-target'));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('supports keyboard events using SyntheticEvent', async () => {
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const target = document.createElement('div');
    target.getBoundingClientRect = mockGetBoundingClientRect(150, 250, 60, 60);

    render(
      <WithContextMenu
        renderMenuItems={() => (
          <>
            <MenuGroup>
              <MenuItem label="Item 1" />
              <MenuItem label="Item 2" />
            </MenuGroup>
          </>
        )}
      >
        {({ openMenu }) => (
          <div
            data-testid="context-menu-target"
            tabIndex={0}
            ref={(el) => {
              if (el) {
                el.getBoundingClientRect = target.getBoundingClientRect;
              }
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                openMenu(ev);
              }
            }}
          >
            Press enter on me
          </div>
        )}
      </WithContextMenu>
    );

    expect(screen.getByTestId('context-menu-target')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

    const menuTarget = screen.getByTestId('context-menu-target');
    menuTarget.focus();

    await userEvent.keyboard('{Enter}');

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true, configurable: true });
  });

  it('supports explicit position object', async () => {
    render(
      <WithContextMenu
        renderMenuItems={() => (
          <>
            <MenuGroup>
              <MenuItem label="Item 1" />
              <MenuItem label="Item 2" />
            </MenuGroup>
          </>
        )}
      >
        {({ openMenu }) => (
          <div
            data-testid="context-menu-target"
            onClick={() => {
              openMenu({ x: 300, y: 400 });
            }}
          >
            Click me
          </div>
        )}
      </WithContextMenu>
    );

    expect(screen.getByTestId('context-menu-target')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('context-menu-target'));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('does not open menu when openMenu is called with undefined', async () => {
    render(
      <WithContextMenu
        renderMenuItems={() => (
          <>
            <MenuGroup>
              <MenuItem label="Item 1" />
              <MenuItem label="Item 2" />
            </MenuGroup>
          </>
        )}
      >
        {({ openMenu }) => (
          <div data-testid="context-menu-target" onClick={() => openMenu(undefined)}>
            Click me
          </div>
        )}
      </WithContextMenu>
    );

    expect(screen.getByTestId('context-menu-target')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('context-menu-target'));

    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
  });
});
