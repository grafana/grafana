import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
});
