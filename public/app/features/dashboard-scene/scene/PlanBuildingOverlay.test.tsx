import { act, render, screen } from '@testing-library/react';

import { PlanBuildingOverlay } from './PlanBuildingOverlay';

describe('PlanBuildingOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('announces only the heading, and rotates the quips beneath it', () => {
    render(<PlanBuildingOverlay />);

    expect(screen.getByRole('status')).toHaveTextContent('Preparing to build your dashboard');
    const firstQuip = screen.getByText('Lining up the gridlines…');
    expect(firstQuip.closest('[aria-hidden="true"]')).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(2800);
    });

    expect(screen.queryByText('Lining up the gridlines…')).not.toBeInTheDocument();
    expect(screen.getByText('Picking a nice shade of blue…')).toBeInTheDocument();
  });
});
