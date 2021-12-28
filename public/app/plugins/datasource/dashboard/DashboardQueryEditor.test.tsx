import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { SHARED_DASHBOARD_QUERY } from './types';
import { DashboardQueryEditor } from './DashboardQueryEditor';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';

jest.mock('app/core/config', () => ({
  ...((jest.requireActual('app/core/config') as unknown) as object),
  panels: {
    timeseries: {
      info: {
        logos: {
          small: '',
        },
      },
    },
  },
}));

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    get: () => ({}),
    getInstanceSettings: () => ({}),
  }),
}));

describe('DashboardQueryEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnRunQueries = jest.fn();
  const mockPanelData = {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
  };
  const mockQueries = [{ refId: 'A' }];
  let mockDashboard: DashboardModel;

  beforeEach(() => {
    mockDashboard = new DashboardModel({
      panels: [
        {
          targets: [],
          type: 'timeseries',
          id: 1,
          title: 'My first panel',
        },
        {
          targets: [],
          id: 2,
          type: 'timeseries',
          title: 'Another panel',
        },
        {
          datasource: {
            uid: SHARED_DASHBOARD_QUERY,
          },
          targets: [],
          id: 3,
          type: 'timeseries',
          title: 'A dashboard query panel',
        },
      ],
    });
    jest.spyOn(getDashboardSrv(), 'getCurrent').mockImplementation(() => mockDashboard);
  });

  it('does not show a panel with the SHARED_DASHBOARD_QUERY datasource as an option in the dropdown', () => {
    render(
      <DashboardQueryEditor
        queries={mockQueries}
        panelData={mockPanelData}
        onChange={mockOnChange}
        onRunQueries={mockOnRunQueries}
      />
    );
    const select = screen.getByText('Choose panel');
    userEvent.click(select);
    expect(screen.getByText('My first panel')).toBeInTheDocument();
    expect(screen.getByText('Another panel')).toBeInTheDocument();
    expect(screen.queryByText('A dashboard query panel')).not.toBeInTheDocument();
  });

  it('does not show the current panelInEdit as an option in the dropdown', () => {
    mockDashboard.initEditPanel(mockDashboard.panels[0]);
    render(
      <DashboardQueryEditor
        queries={mockQueries}
        panelData={mockPanelData}
        onChange={mockOnChange}
        onRunQueries={mockOnRunQueries}
      />
    );
    const select = screen.getByText('Choose panel');
    userEvent.click(select);
    expect(screen.queryByText('My first panel')).not.toBeInTheDocument();
    expect(screen.getByText('Another panel')).toBeInTheDocument();
    expect(screen.queryByText('A dashboard query panel')).not.toBeInTheDocument();
  });
});
