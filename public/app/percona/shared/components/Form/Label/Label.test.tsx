import React from 'react';
import { Label } from './Label';
import { render, screen } from '@testing-library/react';

describe('Label', () => {
  it('should render', () => {
    render(<Label dataTestId="test-label" label="label" />);
    expect(screen.getByTestId('test-label')).toBeInTheDocument();
  });
});
