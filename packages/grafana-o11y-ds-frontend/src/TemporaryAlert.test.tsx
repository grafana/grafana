import { act, render, screen } from '@testing-library/react';

import { TemporaryAlert } from './TemporaryAlert';

describe('TemporaryAlert', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('full component life cycle', async () => {
    render(<TemporaryAlert severity="error" text="" />);
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();

    render(<TemporaryAlert severity="error" text="Error message" />);
    expect(screen.getByTestId('data-testid Alert error')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();

    act(() => jest.runAllTimers());
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });
});
