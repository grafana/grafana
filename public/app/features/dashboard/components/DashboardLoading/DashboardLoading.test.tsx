import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationService } from '@grafana/runtime';
import { DashboardInitPhase } from 'app/types/dashboard';

import { DashboardLoading } from './DashboardLoading';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

describe('DashboardLoading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading state with spinner and cancel button', () => {
    render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);

    expect(screen.getByText('Fetching')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel loading dashboard/i })).toBeInTheDocument();
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
