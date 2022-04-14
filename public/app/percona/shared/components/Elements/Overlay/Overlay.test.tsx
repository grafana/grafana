import React from 'react';
import { Overlay } from './Overlay';
import { render, screen } from '@testing-library/react';

describe('Overlay::', () => {
  it('Renders children correctly', () => {
    render(
      <Overlay isPending={false}>
        <p>Child 1</p>
        <p>Child 2</p>
      </Overlay>
    );
    expect(screen.getByTestId('pmm-overlay-wrapper').children).toHaveLength(2);
  });

  it('Renders overlay and spinner while pending', () => {
    render(
      <Overlay isPending>
        <p>Test</p>
      </Overlay>
    );

    expect(screen.getByTestId('pmm-overlay-wrapper').children).toHaveLength(2);
    expect(screen.getByTestId('pmm-overlay-wrapper').children[0].querySelector('i')).toBeTruthy();
  });

  it('Doesnt render overlay if not pending', () => {
    const { container } = render(
      <Overlay isPending={false}>
        <p>Test</p>
      </Overlay>
    );

    expect(container.querySelector('i')).not.toBeInTheDocument();
  });
});
