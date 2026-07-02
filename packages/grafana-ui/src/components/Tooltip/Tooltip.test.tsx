import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type MutableRefObject } from 'react';

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

  it('moves focus into focusable tooltip content when tabbing', async () => {
    render(
      <Tooltip
        content={
          <TextLink external href="https://grafana.com">
            Tooltip link
          </TextLink>
        }
        focusable
        interactive
      >
        <button>On the page</button>
      </Tooltip>
    );

    await userEvent.tab();

    expect(screen.getByRole('link', { name: 'Tooltip link' })).toHaveFocus();
  });

  it('lets tab move out of the tooltip to the next focusable element', async () => {
    render(
      <>
        <button>Before</button>
        <Tooltip
          content={
            <TextLink external href="https://grafana.com">
              Tooltip link
            </TextLink>
          }
          focusable
          interactive
        >
          <button>Trigger</button>
        </Tooltip>
        <button>After</button>
      </>
    );

    await userEvent.tab();
    await userEvent.tab();

    expect(screen.getByRole('link', { name: 'Tooltip link' })).toHaveFocus();

    await userEvent.tab();

    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });
});
