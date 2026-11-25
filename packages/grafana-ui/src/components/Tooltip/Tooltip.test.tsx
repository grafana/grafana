import { FloatingFocusManager, FloatingPortal, useFloating } from '@floating-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type MutableRefObject, useState } from 'react';

import { TextLink } from '../Link/TextLink';

import { Tooltip } from './Tooltip';

// A small stand-in for a popover, like the dashboard edit actions popover. It renders an element with a Tooltip
// inside, and a floating panel with a button that is rendered in a portal. Pressing Tab on the Tooltip trigger moves
// focus to a hidden focus guard that floating-ui adds, and from there into the panel.
function TriggerWithPortalledSibling() {
  const [open, setOpen] = useState(true);
  const { refs, context } = useFloating({ open, onOpenChange: setOpen });
  const { setReference, setFloating } = refs;

  return (
    <>
      <div ref={setReference}>
        <Tooltip content="Cooltip content">
          <span>On the page</span>
        </Tooltip>
      </div>
      <FloatingPortal>
        <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
          <div ref={setFloating}>
            <button>Portalled button</button>
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    </>
  );
}

describe('Tooltip', () => {
  it('renders correctly', () => {
    render(
      <Tooltip placement="auto" content="Tooltip text">
        <TextLink external href="http://www.grafana.com">
          Link with tooltip
        </TextLink>
      </Tooltip>
    );
    expect(screen.getByText('Link with tooltip')).toBeInTheDocument();
  });

  it('closes when Tab moves focus from the trigger into portalled floating-ui content', async () => {
    render(<TriggerWithPortalledSibling />);

    await userEvent.tab();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Portalled button' })).toHaveFocus();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('forwards the function ref', () => {
    const refFn = jest.fn();

    render(
      <Tooltip content="Cooltip content" ref={refFn}>
        <span>On the page</span>
      </Tooltip>
    );

    expect(refFn).toBeCalled();
  });

  it('forwards the mutable ref', () => {
    const refObj: MutableRefObject<HTMLElement | null> = { current: null };

    render(
      <Tooltip content="Cooltip content" ref={refObj}>
        <span>On the page</span>
      </Tooltip>
    );

    expect(refObj.current).not.toBeNull();
  });

  it('to be shown on hover and be dismissable by pressing Esc key when show is undefined', async () => {
    render(
      <Tooltip content="Tooltip content">
        <span>On the page</span>
      </Tooltip>
    );
    await userEvent.hover(screen.getByText('On the page'));
    expect(await screen.findByText('Tooltip content')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Tooltip content')).not.toBeInTheDocument();
  });

  it('is always visible when show prop is true', async () => {
    render(
      <Tooltip content="Tooltip content" show={true}>
        <span>On the page</span>
      </Tooltip>
    );
    await userEvent.hover(screen.getByText('On the page'));
    expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    await userEvent.unhover(screen.getByText('On the page'));
    expect(screen.getByText('Tooltip content')).toBeInTheDocument();
  });

  it('is never visible when show prop is false', async () => {
    render(
      <Tooltip content="Tooltip content" show={false}>
        <span>On the page</span>
      </Tooltip>
    );
    await userEvent.hover(screen.getByText('On the page'));
    expect(screen.queryByText('Tooltip content')).not.toBeInTheDocument();
  });

  it('exposes the tooltip text to screen readers', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>On the page</button>
      </Tooltip>
    );

    // if tooltip is not visible, description won't be set
    expect(
      screen.queryByRole('button', {
        description: 'Tooltip content',
      })
    ).not.toBeInTheDocument();

    // tab to button to make tooltip visible
    await userEvent.keyboard('{tab}');
    expect(
      await screen.findByRole('button', {
        description: 'Tooltip content',
      })
    ).toBeInTheDocument();
  });
});
