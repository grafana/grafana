import { render, screen } from '@testing-library/react';

import { getBackendSrv } from '@grafana/runtime';

import AlertRulesToolbarButton from './AlertRulesToolbarButton';

describe('AlertRulesToolbarButton', () => {
  it('shows the button when the dashboard has an alert rule', async () => {
    const getMock = jest.spyOn(getBackendSrv(), 'get').mockResolvedValue({
      data: {
        groups: [{ rules: [{}] }],
      },
    });

    render(<AlertRulesToolbarButton dashboardUid="dashboard-1" />);

    expect(await screen.findByRole('button', { name: 'Alert rules' })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('api/prometheus/grafana/api/v1/rules', {
      dashboard_uid: 'dashboard-1',
    });
  });
});
