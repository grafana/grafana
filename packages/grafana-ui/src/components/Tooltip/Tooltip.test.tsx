import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type MutableRefObject } from 'react';

import { TextLink } from '../Link/TextLink';

import { Tooltip } from './Tooltip';

// The portaled content sits elsewhere in the DOM than the trigger, so this only reproduces real
// Tab order (and what `trapFocus` fixes) if there's another focusable element right after the
// trigger for focus to wrongly skip to without it.
function renderInteractiveTooltip(trapFocus: boolean) {
  render(
    <>
      <Tooltip
        content={
          <button>Action inside tooltip</button>
        }
        interactive
        trapFocus={trapFocus}
      >
        <button>Trigger</button>
      </Tooltip>
      <button>Next focusable element on the page</button>
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

  describe('trapFocus', () => {
    it('is a no-op by default: Tab from the trigger skips over interactive content', async () => {
      renderInteractiveTooltip(false);

      await userEvent.tab();
      expect(screen.getByText('Trigger')).toHaveFocus();
      await screen.findByText('Action inside tooltip');

      await userEvent.tab();
      expect(screen.getByText('Next focusable element on the page')).toHaveFocus();
    });

    it('when set, lets Tab from the trigger reach content before moving on, and Escape releases it', async () => {
      renderInteractiveTooltip(true);

      await userEvent.tab();
      expect(screen.getByText('Trigger')).toHaveFocus();
      const actionButton = await screen.findByText('Action inside tooltip');

      await userEvent.tab();
      // FloatingFocusManager moves focus asynchronously.
      await waitFor(() => {
        expect(actionButton).toHaveFocus();
      });

      await userEvent.keyboard('{Escape}');
      expect(screen.getByText('Trigger')).toHaveFocus();
      expect(screen.queryByText('Action inside tooltip')).not.toBeInTheDocument();

      await userEvent.tab();
      expect(screen.getByText('Next focusable element on the page')).toHaveFocus();
    });

    it('renders a visually-hidden dismiss control, for touch screen reader users who have no Escape key', async () => {
      renderInteractiveTooltip(true);

      await userEvent.tab();
      await screen.findByText('Action inside tooltip');

      // Rendered at both the start and end of the trapped content, per floating-ui's own pattern.
      expect(await screen.findAllByRole('button', { name: 'Dismiss' })).not.toHaveLength(0);
    });
  });
});
