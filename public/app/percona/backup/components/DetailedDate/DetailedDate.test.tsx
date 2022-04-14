import React from 'react';
import { DetailedDate } from './DetailedDate';
import { render, screen } from '@testing-library/react';

describe('DetailedDate', () => {
  it('should render', () => {
    render(<DetailedDate date={Date.now()} />);
    expect(screen.getByTestId('detailed-date')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-date').children).toHaveLength(2);
  });
});
