import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { DashboardInitPhase } from 'app/types/dashboard';

import { DashboardLoading } from './DashboardLoading';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  locationService: {
    push: jest.fn(),
  },
}));

describe('DashboardLoading', () => {
  const mockCancelAllInFlightRequests = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getBackendSrv as jest.Mock).mockReturnValue({
      cancelAllInFlightRequests: mockCancelAllInFlightRequests,
    });
  });

  it('renders the loading state with spinner and cancel button', () => {
    render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);

    expect(screen.getByText('Fetching')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel loading dashboard/i })).toBeInTheDocument();
  });

  it('cancels all in-flight requests when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);

    const cancelButton = screen.getByRole('button', { name: /cancel loading dashboard/i });
    await user.click(cancelButton);

    expect(mockCancelAllInFlightRequests).toHaveBeenCalledTimes(1);
  });

  it('navigates to dashboards page when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);

    const cancelButton = screen.getByRole('button', { name: /cancel loading dashboard/i });
    await user.click(cancelButton);

    expect(locationService.push).toHaveBeenCalledWith('/dashboards');
  });

  it('does not navigate to home page to avoid infinite loop', async () => {
    const user = userEvent.setup();
    render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);

    const cancelButton = screen.getByRole('button', { name: /cancel loading dashboard/i });
    await user.click(cancelButton);

    expect(locationService.push).not.toHaveBeenCalledWith('/');
  });
});
