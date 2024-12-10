import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import {
  createDashboardModelFixture,
  createPanelSaveModel,
} from '../../../features/dashboard/state/__fixtures__/dashboardFixtures';

import { DashboardQueryEditor } from './DashboardQueryEditor';
import { DashboardDatasource } from './datasource';
import { SHARED_DASHBOARD_QUERY } from './types';

jest.mock('app/core/config', () => ({
  ...jest.requireActual('app/core/config'),
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

setDataSourceSrv(
  new MockDataSourceSrv({
    test: mockDataSource({ isDefault: true }),
  })
);

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
    mockDashboard = createDashboardModelFixture({
      panels: [
        createPanelSaveModel({
          targets: [],
          type: 'timeseries',
          id: 1,
          title: 'My first panel',
        }),
        createPanelSaveModel({
          targets: [],
          id: 2,
          type: 'timeseries',
          title: 'Another panel',
        }),
        createPanelSaveModel({
          datasource: {
            uid: SHARED_DASHBOARD_QUERY,
          },
          targets: [],
          id: 3,
          type: 'timeseries',
          title: 'A dashboard query panel',
        }),
      ],
    });
    jest.spyOn(getDashboardSrv(), 'getCurrent').mockImplementation(() => mockDashboard);
  });

  it('does not show a panel with the SHARED_DASHBOARD_QUERY datasource as an option in the dropdown', async () => {
    render(
      <DashboardQueryEditor
        datasource={{} as DashboardDatasource}
        query={mockQueries[0]}
        data={mockPanelData}
        onChange={mockOnChange}
        onRunQuery={mockOnRunQueries}
      />
    );
    const select = screen.getByText('Choose panel');

    await userEvent.click(select);

    const myFirstPanel = await screen.findByText('My first panel');
    expect(myFirstPanel).toBeInTheDocument();

    const anotherPanel = await screen.findByText('Another panel');
    expect(anotherPanel).toBeInTheDocument();

    expect(screen.queryByText('A dashboard query panel')).not.toBeInTheDocument();
  });

  it('does not show the current panelInEdit as an option in the dropdown', async () => {
    mockDashboard.initEditPanel(mockDashboard.panels[0]);
    render(
      <DashboardQueryEditor
        datasource={{} as DashboardDatasource}
        query={mockQueries[0]}
        data={mockPanelData}
        onChange={mockOnChange}
        onRunQuery={mockOnRunQueries}
      />
    );
    const select = screen.getByText('Choose panel');

    await userEvent.click(select);

    expect(screen.queryByText('My first panel')).not.toBeInTheDocument();

    const anotherPanel = await screen.findByText('Another panel');
    expect(anotherPanel).toBeInTheDocument();

    expect(screen.queryByText('A dashboard query panel')).not.toBeInTheDocument();
  });
});
