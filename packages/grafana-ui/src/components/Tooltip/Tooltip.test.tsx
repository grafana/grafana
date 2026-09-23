import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type MutableRefObject, useState } from 'react';

import { TextLink } from '../Link/TextLink';

import { Tooltip } from './Tooltip';

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

  it('does not crash when an unstable function ref re-renders the parent on every ref call (#130469)', () => {
    // An inline function ref gets a new identity on every parent render, which
    // makes React re-invoke it (null, then the node) on each commit. When the
    // ref also triggers a parent re-render, this used to cascade through the
    // floating-ui reference state updates into React's nested-update limit
    // ("Maximum update depth exceeded", error #185).
    const UnstableRefTooltip = () => {
      const [, forceRender] = useState(0);
      return (
        <Tooltip content="Tooltip content" ref={() => forceRender((v) => v + 1)}>
          <span>On the page</span>
        </Tooltip>
      );
    };

    expect(() => render(<UnstableRefTooltip />)).not.toThrow();
    expect(screen.getByText('On the page')).toBeInTheDocument();
  });

  it('keeps the floating reference intact when the parent re-renders with a new function ref', async () => {
    const { rerender } = render(
      <Tooltip content="Tooltip content" ref={() => {}}>
        <span>On the page</span>
      </Tooltip>
    );
    // new function ref identity on every render must not detach the reference
    rerender(
      <Tooltip content="Tooltip content" ref={() => {}}>
        <span>On the page</span>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('On the page'));
    expect(await screen.findByText('Tooltip content')).toBeInTheDocument();
  });

  it('surfaces the current node to a swapped object ref', () => {
    const firstRef: MutableRefObject<HTMLElement | null> = { current: null };
    const secondRef: MutableRefObject<HTMLElement | null> = { current: null };

    const { rerender } = render(
      <Tooltip content="Tooltip content" ref={firstRef}>
        <span>On the page</span>
      </Tooltip>
    );
    expect(firstRef.current).not.toBeNull();

    rerender(
      <Tooltip content="Tooltip content" ref={secondRef}>
        <span>On the page</span>
      </Tooltip>
    );
    expect(secondRef.current).toBe(firstRef.current);
  });
});
