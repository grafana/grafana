import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationService } from '@grafana/runtime';

import { DashboardInitPhase } from 'app/types/dashboard';

import { DashboardLoading } from './DashboardLoading';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    getSearchObject: jest.fn(),
    push: jest.fn(),
  },
}));

const mockGetSearchObject = locationService.getSearchObject as jest.Mock;
const mockPush = locationService.push as jest.Mock;

describe('DashboardLoading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('without kiosk=embed', () => {
    beforeEach(() => {
      mockGetSearchObject.mockReturnValue({});
    });

    it('renders the init phase text', () => {
      render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);
      expect(screen.getByText(DashboardInitPhase.Fetching)).toBeInTheDocument();
    });

    it('renders the Cancel loading dashboard button', () => {
      render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);
      expect(screen.getByRole('button', { name: /cancel loading dashboard/i })).toBeInTheDocument();
    });

    it('navigates to home when Cancel loading dashboard is clicked', async () => {
      render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);
      await userEvent.click(screen.getByRole('button', { name: /cancel loading dashboard/i }));
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('with kiosk=embed', () => {
    beforeEach(() => {
      mockGetSearchObject.mockReturnValue({ kiosk: 'embed' });
    });

    it('renders the init phase text', () => {
      render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);
      expect(screen.getByText(DashboardInitPhase.Fetching)).toBeInTheDocument();
    });

    it('hides the Cancel loading dashboard button', () => {
      render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);
      expect(screen.queryByRole('button', { name: /cancel loading dashboard/i })).not.toBeInTheDocument();
    });

    it('does not navigate when dashboard is loading', async () => {
      render(<DashboardLoading initPhase={DashboardInitPhase.Fetching} />);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
