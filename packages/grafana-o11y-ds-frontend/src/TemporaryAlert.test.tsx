import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { TemporaryAlert } from './TemporaryAlert';

describe('TemporaryAlert', () => {
  it('full component life cycle', async () => {
    render(<TemporaryAlert duration={1000} severity="error" text="" />);
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();

    render(<TemporaryAlert duration={1000} severity="error" text="error message" />);
    expect(screen.queryByTestId('data-testid Alert error')).toBeInTheDocument();
    expect(screen.getByText('error message')).toBeInTheDocument();

    await act(() => new Promise((_) => setTimeout(_, 1000)));
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
    expect(screen.queryByText('error message')).not.toBeInTheDocument();
  });
});
