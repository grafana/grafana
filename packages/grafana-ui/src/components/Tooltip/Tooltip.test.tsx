import { render, screen } from '@testing-library/react';
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
});
