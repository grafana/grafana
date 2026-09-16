import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataSourceInstanceSettings,
  getDefaultTimeRange,
  LoadingState,
  type PanelPluginMeta,
} from '@grafana/data';
import { usePanelPluginMetasMap } from '@grafana/runtime/internal';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import {
  createDashboardModelFixture,
  createPanelSaveModel,
} from '../../../features/dashboard/state/__fixtures__/dashboardFixtures';
import { MIXED_DATASOURCE_NAME } from '../mixed/MixedDataSource';

import { DashboardQueryEditor, INVALID_PANEL_DESCRIPTION } from './DashboardQueryEditor';
import { SHARED_DASHBOARD_QUERY } from './constants';
import { type DashboardDatasource } from './datasource';
import { type DashboardQuery } from './types';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  usePanelPluginMetasMap: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(async () => ({
    name: 'Default DS',
    uid: 'default-ds',
    meta: { info: { logos: { small: 'https://example.com/logo.svg' } } },
  })),
  getDataSourceInstanceSettings: jest.fn(async () => ({
    name: 'Default DS',
    uid: 'default-ds',
  })),
}));

const usePanelPluginMetasMapMock = jest.mocked(usePanelPluginMetasMap);
const getDataSourceInstanceSettingsMock = jest.mocked(getDataSourceInstanceSettings);

function mockInstanceSettings(name: string, uid: string): DataSourceInstanceSettings {
  return { name, uid } as DataSourceInstanceSettings;
}

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
    getDataSourceInstanceSettingsMock.mockResolvedValue(mockInstanceSettings('Default DS', 'default-ds'));

    usePanelPluginMetasMapMock.mockReturnValue({
      loading: false,
      error: undefined,
      value: {
        timeseries: {
          id: 'timeseries',
          name: 'Time series',
          info: { logos: { small: '' } },
        } as PanelPluginMeta,
      },
    });

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

  it('does not show plugins Alert', async () => {
    const query: DashboardQuery = { refId: 'A', panelId: 1, adHocFiltersEnabled: false };
    const { queryByText } = await waitFor(() =>
      render(
        <DashboardQueryEditor
          datasource={{} as DashboardDatasource}
          query={query}
          data={mockPanelData}
          onChange={() => {}}
          onRunQuery={() => {}}
        />
      )
    );

    const alert = queryByText('Failed to load panel plugins');
    expect(alert).toBe(null);
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

  it('uses the default datasource name for panels without a datasource ref', async () => {
    render(
      <DashboardQueryEditor
        datasource={{} as DashboardDatasource}
        query={mockQueries[0]}
        data={mockPanelData}
        onChange={mockOnChange}
        onRunQuery={mockOnRunQueries}
      />
    );

    await userEvent.click(screen.getByText('Choose panel'));

    await waitFor(() => {
      expect(screen.getByText('My first panel').nextElementSibling).toHaveTextContent('1 query to Default DS');
      expect(screen.getByText('Another panel').nextElementSibling).toHaveTextContent('1 query to Default DS');
    });
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

  it('shows the resolved datasource name for each type-only panel ref', async () => {
    getDataSourceInstanceSettingsMock.mockImplementation(async (ref) => {
      if (typeof ref === 'object' && ref?.type === 'prometheus') {
        return mockInstanceSettings('Prometheus', 'prom-uid');
      }
      if (typeof ref === 'object' && ref?.type === 'loki') {
        return mockInstanceSettings('Loki', 'loki-uid');
      }
      return mockInstanceSettings('Default DS', 'default-ds');
    });

    mockDashboard = createDashboardModelFixture({
      panels: [
        createPanelSaveModel({
          datasource: { type: 'prometheus' },
          targets: [{ refId: 'A' }],
          type: 'timeseries',
          id: 1,
          title: 'Prom panel',
        }),
        createPanelSaveModel({
          datasource: { type: 'loki' },
          targets: [{ refId: 'A' }, { refId: 'B' }],
          type: 'timeseries',
          id: 2,
          title: 'Loki panel',
        }),
      ],
    });
    jest.spyOn(getDashboardSrv(), 'getCurrent').mockImplementation(() => mockDashboard);

    render(
      <DashboardQueryEditor
        datasource={{} as DashboardDatasource}
        query={mockQueries[0]}
        data={mockPanelData}
        onChange={mockOnChange}
        onRunQuery={mockOnRunQueries}
      />
    );

    await userEvent.click(screen.getByText('Choose panel'));

    await waitFor(() => {
      expect(screen.getByText('Prom panel').nextElementSibling).toHaveTextContent('1 query to Prometheus');
      expect(screen.getByText('Loki panel').nextElementSibling).toHaveTextContent('2 queries to Loki');
    });
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

    it('shows the AdHoc Filters toggle', async () => {
      const query: DashboardQuery = { refId: 'A', panelId: 1, adHocFiltersEnabled: false };

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

      const adhocFiltersToggle = await screen.findByText('Filters');
      expect(adhocFiltersToggle).toBeInTheDocument();
    });
  });

  describe('usePanelPluginMetasMap errors', () => {
    beforeEach(() => {
      usePanelPluginMetasMapMock.mockReturnValue({
        loading: false,
        error: new Error('Network error'),
        value: undefined,
      });
    });

    it('shows the error', async () => {
      const query: DashboardQuery = { refId: 'A', panelId: 1, adHocFiltersEnabled: false };
      const { findByText } = await waitFor(() =>
        render(
          <DashboardQueryEditor
            datasource={{} as DashboardDatasource}
            query={query}
            data={mockPanelData}
            onChange={() => {}}
            onRunQuery={() => {}}
          />
        )
      );

      const alert = await findByText('Failed to load panel plugins');
      expect(alert).toBeInTheDocument();

      const error = await findByText('Network error');
      expect(error).toBeInTheDocument();
    });
  });
});
