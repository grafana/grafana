import { act, render, screen } from '@testing-library/react';

import { TemporaryAlert } from './TemporaryAlert';

describe('TemporaryAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('full component life cycle', async () => {
    render(<TemporaryAlert severity="error" text="" />);
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();

    render(<TemporaryAlert severity="error" text="Error message" />);
    expect(screen.getByTestId('data-testid Alert error')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();

    act(() => vi.runAllTimers());
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });
});
