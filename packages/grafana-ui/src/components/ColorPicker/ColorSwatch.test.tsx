import { render, screen } from '@testing-library/react';

import { ColorSwatch } from './ColorSwatch';

describe('ColorSwatch', () => {
  it('uses the default pick-a-color name when no label is provided', () => {
    render(<ColorSwatch color="#ff0000" />);

    expect(screen.getByRole('button', { name: 'Pick a color' })).toBeInTheDocument();
  });

  it('names the button from the color label', () => {
    render(<ColorSwatch color="#ff0000" aria-label="red" />);

    expect(screen.getByRole('button', { name: 'red color' })).toBeInTheDocument();
  });

  it('uses aria-labelledby instead of the default name when provided', () => {
    render(
      <>
        <span id="swatch-name">Pick a color, current selection green</span>
        <ColorSwatch color="#00ff00" aria-labelledby="swatch-name" />
      </>
    );

    const swatch = screen.getByRole('button', { name: 'Pick a color, current selection green' });
    expect(swatch).toHaveAttribute('aria-labelledby', 'swatch-name');
    expect(swatch).not.toHaveAttribute('aria-label');
  });
});
