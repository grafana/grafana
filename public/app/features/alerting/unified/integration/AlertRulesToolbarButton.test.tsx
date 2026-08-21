import { render, screen } from '@testing-library/react';

import { backendSrv } from 'app/core/services/backend_srv';

import { mockGrafanaPromAlertingRule } from '../mocks';
import { Annotation } from '../utils/constants';

import AlertRulesToolbarButton from './AlertRulesToolbarButton';

describe('AlertRulesToolbarButton', () => {
  it('shows the button when the dashboard has an alert rule', async () => {
    const getMock = jest.spyOn(backendSrv, 'get').mockResolvedValue({
      data: {
        groups: [
          {
            name: 'group',
            file: 'folder',
            rules: [
              mockGrafanaPromAlertingRule({
                annotations: { [Annotation.panelID]: '1' },
              }),
            ],
          },
        ],
      },
    });

    render(<AlertRulesToolbarButton dashboardUid="dashboard-1" />);

    expect(await screen.findByRole('button', { name: 'Alert rules' })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('api/prometheus/grafana/api/v1/rules', {
      dashboard_uid: 'dashboard-1',
    });
  });
});
