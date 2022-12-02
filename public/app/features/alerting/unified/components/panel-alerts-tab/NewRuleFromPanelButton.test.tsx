import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { logInfo } from '@grafana/runtime';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { LogMessages } from '../../Analytics';

import { NewRuleFromPanelButton } from './NewRuleFromPanelButton';

jest.mock('app/types', () => {
  const original = jest.requireActual('app/types');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

jest.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: 'localhost:3000/example/path',
  }),
}));

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    logInfo: jest.fn(),
  };
});

jest.mock('react-use', () => ({
  useAsync: () => ({ loading: false, value: {} }),
}));

describe('Analytics', () => {
  it('Sends log info when creating an alert rule from a panel', async () => {
    const panel = new PanelModel({
      id: 123,
    });
    const dashboard = new DashboardModel({
      id: 1,
    });
    render(<NewRuleFromPanelButton panel={panel} dashboard={dashboard} />);

    const button = screen.getByText('Create alert rule from this panel');

    button.addEventListener('click', (event) => event.preventDefault(), false);

    await userEvent.click(button);

    expect(logInfo).toHaveBeenCalledWith(LogMessages.alertRuleFromPanel);
  });
});
