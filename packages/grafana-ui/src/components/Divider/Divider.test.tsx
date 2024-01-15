import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';
import React from 'react';

import { Divider } from './Divider';

describe('Divider', () => {
  it('should render horizontal divider', () => {
    render(<Divider direction="horizontal" />);
    expect(screen.getByTestId('horizontal-divider')).toBeInTheDocument();
  });

  it('should render vertical divider', () => {
    render(<Divider direction="vertical" />);
    expect(screen.getByTestId('vertical-divider')).toBeInTheDocument();
  });

  it('should render divider with line by default', () => {
    render(<Divider />);
    const divider = screen.getByTestId('horizontal-divider');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveStyle('border-top: 1px solid rgba(204, 204, 220, 0.12)');
  });

  it('should render divider without line if specified', () => {
    render(<Divider showLine={false} />);
    const divider = screen.getByTestId('horizontal-divider');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveStyle('border-top: none');
  });
});
