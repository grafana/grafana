import { render, screen } from '@testing-library/react';

import AlertRulesToolbarButton from './AlertRulesToolbarButton';

const mockGet = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
}));

describe('AlertRulesToolbarButton', () => {
  it('shows the button when the dashboard has an alert rule', async () => {
    mockGet.mockResolvedValue({
      data: {
        groups: [{ rules: [{}] }],
      },
    });

    render(<AlertRulesToolbarButton dashboardUid="dashboard-1" />);

    expect(await screen.findByRole('button', { name: 'Alert rules' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('api/prometheus/grafana/api/v1/rules', {
      dashboard_uid: 'dashboard-1',
    });
  });
});
