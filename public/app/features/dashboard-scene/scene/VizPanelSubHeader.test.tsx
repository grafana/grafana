import { render, waitFor, act } from '@testing-library/react';

import { DataSourceApi, LoadingState, DataQueryRequest } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  AdHocFiltersVariable,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { VizPanelSubHeader } from './VizPanelSubHeader';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// Mock @grafana/runtime
const mockGetDataSource = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: mockGetDataSource,
  }),
}));

describe('VizPanelSubHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error when not used with VizPanel', () => {
    const subHeader = new VizPanelSubHeader({});
    const scene = new SceneFlexLayout({
      children: [new SceneFlexItem({ body: subHeader })],
    });

    expect(() => activateFullSceneTree(scene)).toThrow('VizPanelSubHeader can be used only for VizPanel');
  });

  it('should render PanelNonApplicableFiltersSubHeader when datasource supports getDrilldownsApplicability', async () => {
    const mockDatasource = {
      getDrilldownsApplicability: jest.fn().mockResolvedValue([]),
    } as unknown as DataSourceApi;

    mockGetDataSource.mockResolvedValue(mockDatasource);

    const subHeader = new VizPanelSubHeader({});
    const panel = buildTestPanel(subHeader);

    panel.state.$data?.setState({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: panel.state.$data.state.data?.timeRange!,
        request: {
          targets: [
            {
              refId: 'A',
              datasource: { uid: 'test-ds' },
            },
          ],
        } as DataQueryRequest,
      },
    });

    render(<subHeader.Component model={subHeader} />);

    await waitFor(() => {
      expect(mockGetDataSource).toHaveBeenCalledWith({ uid: 'test-ds' });
    });

    expect(subHeader.state.nonApplicableFiltersSubHeader).toBeDefined();
  });

  it('should not render when datasource does not support getDrilldownsApplicability', async () => {
    const mockDatasource = {} as DataSourceApi;

    mockGetDataSource.mockResolvedValue(mockDatasource);

    const subHeader = new VizPanelSubHeader({});
    const panel = buildTestPanel(subHeader);

    panel.state.$data?.setState({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: panel.state.$data.state.data?.timeRange!,
        request: {
          targets: [
            {
              refId: 'A',
              datasource: { uid: 'test-ds' },
            },
          ],
        } as DataQueryRequest,
      },
    });

    const { container } = render(<subHeader.Component model={subHeader} />);

    await waitFor(() => {
      expect(mockGetDataSource).toHaveBeenCalledWith({ uid: 'test-ds' });
    });

    // Should not render anything
    expect(container.firstChild).toBeNull();
  });

  it('should not render when datasource reference is not available', async () => {
    const subHeader = new VizPanelSubHeader({});
    const panel = buildTestPanel(subHeader, false);

    panel.state.$data?.setState({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: panel.state.$data.state.data?.timeRange!,
        request: {
          targets: [],
        } as unknown as DataQueryRequest,
      },
    });

    const { container } = render(<subHeader.Component model={subHeader} />);

    await waitFor(() => {
      expect(mockGetDataSource).not.toHaveBeenCalled();
    });

    // Should not render anything
    expect(container.firstChild).toBeNull();
  });

  it('should handle datasource fetch errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDataSource.mockRejectedValue(new Error('Datasource not found'));

    const subHeader = new VizPanelSubHeader({});
    const panel = buildTestPanel(subHeader);

    panel.state.$data?.setState({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: panel.state.$data.state.data?.timeRange!,
        request: {
          targets: [
            {
              refId: 'A',
              datasource: { uid: 'test-ds' },
            },
          ],
        } as DataQueryRequest,
      },
    });

    const { container } = render(<subHeader.Component model={subHeader} />);

    await waitFor(() => {
      expect(mockGetDataSource).toHaveBeenCalledWith({ uid: 'test-ds' });
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking datasource for getDrilldownsApplicability:',
        expect.any(Error)
      );
    });

    // Should not render anything on error
    expect(container.firstChild).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it('should have nonApplicableFiltersSubHeader in state', () => {
    const subHeader = new VizPanelSubHeader({});
    buildTestPanel(subHeader);

    expect(subHeader.state.nonApplicableFiltersSubHeader).toBeDefined();
    expect(subHeader.state.nonApplicableFiltersSubHeader?.constructor.name).toBe('PanelNonApplicableFiltersSubHeader');
  });

  it('should update when datasource reference changes in data', async () => {
    const mockDatasource1 = {
      getDrilldownsApplicability: jest.fn().mockResolvedValue([]),
    } as unknown as DataSourceApi;

    const mockDatasource2 = {} as DataSourceApi;

    mockGetDataSource.mockResolvedValueOnce(mockDatasource1);

    const subHeader = new VizPanelSubHeader({});
    const panel = buildTestPanel(subHeader);

    panel.state.$data?.setState({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: panel.state.$data.state.data?.timeRange!,
        request: {
          targets: [
            {
              refId: 'A',
              datasource: { uid: 'test-ds' },
            },
          ],
        } as DataQueryRequest,
      },
    });

    const { container, rerender } = render(<subHeader.Component model={subHeader} />);

    await waitFor(() => {
      expect(mockGetDataSource).toHaveBeenCalledWith({ uid: 'test-ds' });
    });

    // Datasource supports getDrilldownsApplicability, so component should be ready to render
    expect(subHeader.state.nonApplicableFiltersSubHeader).toBeDefined();

    // Change the datasource to one without getDrilldownsApplicability
    mockGetDataSource.mockResolvedValueOnce(mockDatasource2);

    // Update the panel's data with a different datasource
    await act(async () => {
      panel.state.$data?.setState({
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: panel.state.$data.state.data?.timeRange!,
          request: {
            targets: [
              {
                refId: 'A',
                datasource: { uid: 'different-ds' },
              },
            ],
          } as DataQueryRequest,
        },
      });
    });

    rerender(<subHeader.Component model={subHeader} />);

    await waitFor(() => {
      expect(mockGetDataSource).toHaveBeenCalledWith({ uid: 'different-ds' });
    });

    // Should not render with second datasource
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

function buildTestPanel(subHeader: VizPanelSubHeader, withDatasource: boolean = true): VizPanel {
  const queries = withDatasource
    ? [
        {
          refId: 'A',
          datasource: { uid: 'test-ds' },
        },
      ]
    : [];

  const adHocVariable = new AdHocFiltersVariable({
    name: 'filters',
    applyMode: 'manual',
    filters: [],
  });

  const panel = new VizPanel({
    title: 'Test Panel',
    pluginId: 'table',
    subHeader: [subHeader],
    $data: new SceneQueryRunner({
      datasource: withDatasource ? { uid: 'test-ds' } : undefined,
      queries,
    }),
  });

  panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables: [adHocVariable] }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  scene.activate();
  if (scene.state.$variables) {
    scene.state.$variables.activate();
  }

  subHeader.activate();

  return panel;
}
