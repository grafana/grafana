import React from 'react';
import { EmptyBlock } from './EmptyBlock';
import { render, screen } from '@testing-library/react';

describe('EmptyBlock', () => {
  it('render external wrapper with data-testid attribute', () => {
    render(<EmptyBlock dataTestId="test-data-testid" />);
    expect(screen.getByTestId('test-data-testid')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <EmptyBlock dataTestId="test-data-testid">
        <span data-testid="span-test">TEST</span>
      </EmptyBlock>
    );
    expect(screen.getByTestId('span-test')).toBeInTheDocument();
  });
});
