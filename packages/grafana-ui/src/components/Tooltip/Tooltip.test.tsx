import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { MutableRefObject } from 'react';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders correctly', () => {
    render(
      <Tooltip placement="auto" content="Tooltip text">
        <a className="test-class" href="http://www.grafana.com">
          Link with tooltip
        </a>
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
});
