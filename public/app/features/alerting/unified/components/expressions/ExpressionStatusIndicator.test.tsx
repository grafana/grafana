import { screen, render } from '@testing-library/react';
import React from 'react';

import { ExpressionStatusIndicator } from './ExpressionStatusIndicator';

describe('ExpressionStatusIndicator', () => {
  it('should render one element if condition', () => {
    render(<ExpressionStatusIndicator isCondition />);

    expect(screen.getByText('Alert condition')).toBeInTheDocument();
  });

  it('should render one element if not condition', () => {
    render(<ExpressionStatusIndicator isCondition={false} />);

    expect(screen.queryByRole('button', { name: 'Alert condition' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set as alert condition' })).toBeInTheDocument();
  });
});
