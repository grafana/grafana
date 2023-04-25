import { render, screen } from '@testing-library/react';
import React from 'react';

import { Overlay } from './Overlay';

describe('Overlay::', () => {
  it('Renders children correctly', () => {
    render(
      <Overlay isPending={false}>
        <p>Child 1</p>
        <p>Child 2</p>
      </Overlay>
    );
    const wrapper = screen.getByTestId('pmm-overlay-wrapper');

    expect(wrapper.children).toHaveLength(2);
  });

  it('Renders overlay and spinner while pending', () => {
    render(
      <Overlay isPending>
        <p>Test</p>
      </Overlay>
    );

    expect(screen.getByTestId('pmm-overlay-wrapper').children).toHaveLength(2);
    expect(screen.queryByTestId('overlay-spinner')).toBeInTheDocument();
  });

  it('Doesnt render overlay if not pending', () => {
    render(
      <Overlay isPending={false}>
        <p>Test</p>
      </Overlay>
    );

    expect(screen.queryByTestId('overlay-spinner')).not.toBeInTheDocument();
  });
});
