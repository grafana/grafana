import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import config from 'app/core/config';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import {
  createDashboardModelFixture,
  createPanelSaveModel,
} from '../../../features/dashboard/state/__fixtures__/dashboardFixtures';
import { MIXED_DATASOURCE_NAME } from '../mixed/MixedDataSource';

import { DashboardQueryEditor, INVALID_PANEL_DESCRIPTION } from './DashboardQueryEditor';
import { SHARED_DASHBOARD_QUERY } from './constants';
import { DashboardDatasource } from './datasource';
import { DashboardQuery } from './types';

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
  featureToggles: {
    dashboardDsAdHocFiltering: false, // Default to false, can be overridden in tests
  },
}));

setupDataSources(mockDataSource({ isDefault: true }));

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
            uid: MIXED_DATASOURCE_NAME,
          },
          targets: [
            {
              datasource: {
                uid: SHARED_DASHBOARD_QUERY,
              },
            },
          ],
          id: 3,
          type: 'timeseries',
          title: 'A mixed DS with dashboard DS query panel',
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

    expect(screen.queryByText('A dashboard query panel')?.nextElementSibling).toHaveTextContent(
      INVALID_PANEL_DESCRIPTION
    );
  });

  it('does not show a panel with either SHARED_DASHBOARD_QUERY datasource or MixedDS with SHARED_DASHBOARD_QUERY as an option in the dropdown', async () => {
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

    expect(screen.queryByText('A dashboard query panel')?.nextElementSibling).toHaveTextContent(
      INVALID_PANEL_DESCRIPTION
    );
    expect(screen.queryByText('A mixed DS with dashboard DS query panel')?.nextElementSibling).toHaveTextContent(
      INVALID_PANEL_DESCRIPTION
    );
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

    expect(screen.queryByText('A dashboard query panel')?.nextElementSibling).toHaveTextContent(
      INVALID_PANEL_DESCRIPTION
    );
  });

  describe('AdHoc Filters Toggle', () => {
    beforeEach(() => {
      // Reset only the specific mocks we need, not all mocks
      mockOnChange.mockClear();
      mockOnRunQueries.mockClear();
      // Re-establish the dashboard mock in case it was cleared
      jest.spyOn(getDashboardSrv(), 'getCurrent').mockImplementation(() => mockDashboard);
    });

    it('shows the AdHoc Filters toggle when feature toggle is enabled', async () => {
      await act(async () => {
        config.featureToggles.dashboardDsAdHocFiltering = true;
      });

      const query: DashboardQuery = { refId: 'A', panelId: 1, useAdHocFilters: false };

      await act(async () => {
        render(
          <DashboardQueryEditor
            datasource={{} as DashboardDatasource}
            query={query}
            data={mockPanelData}
            onChange={mockOnChange}
            onRunQuery={mockOnRunQueries}
          />
        );
      });

      const adhocFiltersToggle = await screen.findByText('AdHoc Filters');
      expect(adhocFiltersToggle).toBeInTheDocument();
    });

    it('does not show the AdHoc Filters toggle when feature toggle is disabled', async () => {
      await act(async () => {
        config.featureToggles.dashboardDsAdHocFiltering = false;
      });

      const query: DashboardQuery = { refId: 'A', panelId: 1, useAdHocFilters: false };

      await act(async () => {
        render(
          <DashboardQueryEditor
            datasource={{} as DashboardDatasource}
            query={query}
            data={mockPanelData}
            onChange={mockOnChange}
            onRunQuery={mockOnRunQueries}
          />
        );
      });

      // Wait for any async operations to complete
      await waitFor(() => {
        expect(screen.queryByText('AdHoc Filters')).not.toBeInTheDocument();
      });
    });
  });
});
