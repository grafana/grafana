import { act, render, screen } from '@testing-library/react';
import { NEVER } from 'rxjs';

import { DataQueryRequest, DataSourceApi, LoadingState, PanelData } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { PanelQueryLatency } from './PanelQueryLatency';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// Use NEVER so the query runner never auto-runs; data is injected manually in each test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (_ds: DataSourceApi, _request: DataQueryRequest) => NEVER,
  getDataSourceSrv: () => ({
    get: jest.fn().mockResolvedValue({ getRef: () => ({ uid: 'ds-1', type: 'test' }) }),
    getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds-1', type: 'test' }),
  }),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => undefined),
  }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('PanelQueryLatency', () => {
  it('renders nothing when showQueryLatency is false (default)', async () => {
    const { latencyItem, queryRunner } = buildScene();

    await act(async () => {
      render(<PanelQueryLatency.Component model={latencyItem} />);
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Done, startTime: 1000, endTime: 1500 }) });
    });

    expect(screen.queryByText(/\d+ms|\d+\.\d+s/)).not.toBeInTheDocument();
  });

  it('renders the latency badge when showQueryLatency is true and query is done', async () => {
    const { latencyItem, scene, queryRunner } = buildScene();
    scene.setState({ showQueryLatency: true });

    await act(async () => {
      render(<PanelQueryLatency.Component model={latencyItem} />);
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Done, startTime: 1000, endTime: 1234 }) });
    });

    expect(screen.getByText('234ms')).toBeInTheDocument();
  });

  it('formats durations >= 1000ms as seconds', async () => {
    const { latencyItem, scene, queryRunner } = buildScene();
    scene.setState({ showQueryLatency: true });

    await act(async () => {
      render(<PanelQueryLatency.Component model={latencyItem} />);
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Done, startTime: 1000, endTime: 2500 }) });
    });

    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('renders nothing when query is done but endTime is missing', async () => {
    const { latencyItem, scene, queryRunner } = buildScene();
    scene.setState({ showQueryLatency: true });

    await act(async () => {
      render(<PanelQueryLatency.Component model={latencyItem} />);
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Done, startTime: 1000, endTime: undefined }) });
    });

    expect(screen.queryByText(/\d+ms|\d+\.\d+s/)).not.toBeInTheDocument();
  });

  it('counts up while a query is loading', async () => {
    const startTime = 1000;
    // Fake timers must be set up before render so the setInterval in useEffect
    // is registered under fake timers and can be advanced with jest.
    jest.useFakeTimers();
    jest.setSystemTime(startTime);

    const { latencyItem, scene, queryRunner } = buildScene();
    scene.setState({ showQueryLatency: true });

    await act(async () => {
      render(<PanelQueryLatency.Component model={latencyItem} />);
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Loading, startTime }) });
    });

    // Initially elapsed is 0 (Date.now() - startTime = 0)
    expect(screen.getByText('0ms')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText('300ms')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('snaps to final time when query completes', async () => {
    const startTime = 1000;
    jest.useFakeTimers();
    jest.setSystemTime(startTime);

    const { latencyItem, scene, queryRunner } = buildScene();
    scene.setState({ showQueryLatency: true });

    await act(async () => {
      render(<PanelQueryLatency.Component model={latencyItem} />);
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Loading, startTime }) });
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    act(() => {
      queryRunner.setState({
        data: makePanelData({ state: LoadingState.Done, startTime, endTime: startTime + 457 }),
      });
    });

    expect(screen.getByText('457ms')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('renders the speedometer icon', async () => {
    const { latencyItem, scene, queryRunner } = buildScene();
    scene.setState({ showQueryLatency: true });

    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<PanelQueryLatency.Component model={latencyItem} />));
    });

    act(() => {
      queryRunner.setState({ data: makePanelData({ state: LoadingState.Done, startTime: 1000, endTime: 1200 }) });
    });

    expect(screen.getByText('200ms')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// --- helpers ---

interface DataOptions {
  state: LoadingState;
  startTime: number;
  endTime?: number;
}

function makePanelData({ state, startTime, endTime }: DataOptions): PanelData {
  return {
    state,
    series: [],
    timeRange: { from: {} as never, to: {} as never, raw: { from: 'now-6h', to: 'now' } },
    request: {
      requestId: 'test',
      interval: '1m',
      intervalMs: 60000,
      range: { from: {} as never, to: {} as never, raw: { from: 'now-6h', to: 'now' } },
      scopedVars: {},
      targets: [],
      timezone: 'browser',
      app: 'dashboard',
      startTime,
      endTime,
    },
  };
}

function buildScene() {
  const latencyItem = new PanelQueryLatency({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'ds-1' },
    queries: [{ refId: 'A' }],
  });

  const panel = new VizPanel({
    key: 'panel-1',
    title: 'Test Panel',
    pluginId: 'timeseries',
    titleItems: [latencyItem],
    $data: queryRunner,
  });

  const scene = new DashboardScene({
    title: 'Test dashboard',
    uid: 'test-dash',
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  activateFullSceneTree(scene);

  return { scene, panel, latencyItem, queryRunner };
}
