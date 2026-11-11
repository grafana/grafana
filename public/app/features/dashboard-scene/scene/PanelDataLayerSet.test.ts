import { waitFor } from '@testing-library/react';
import { advanceTo, clear } from 'jest-date-mock';
import { type Observable, of, Subject } from 'rxjs';

import { type DataQueryRequest, type DataSourceApi, LoadingState, type PanelData, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneFlexItem, SceneFlexLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { defaultPanelSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { buildVizPanelState } from '../serialization/layoutSerializers/utils';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { PanelTimeRange } from './panel-timerange/PanelTimeRange';

const annotationTime = Date.parse('2019-02-08T20:00:00Z');
const runRequest = jest.fn((ds: DataSourceApi, request: DataQueryRequest): Observable<PanelData> => {
  const inRange = request.range.from.valueOf() <= annotationTime && request.range.to.valueOf() >= annotationTime;
  return of({
    state: LoadingState.Done,
    timeRange: request.range,
    series: inRange ? [toDataFrame([{ time: annotationTime, text: 'Deployment', panelId: 0 }])] : [],
  });
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ({ annotations: { prepareQuery: () => ({ refId: 'Anno' }) } }),
  }),
  getRunRequest: () => runRequest,
}));

describe('panel annotation time ranges', () => {
  const deactivate: Array<() => void> = [];

  beforeAll(() => {
    const plugin = getPanelPlugin({});
    setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });
  });

  beforeEach(() => {
    advanceTo(new Date('2019-02-11T19:00:00Z'));
    runRequest.mockClear();
  });

  afterEach(() => {
    deactivate.reverse().forEach((stop) => stop());
    deactivate.length = 0;
    clear();
  });

  function setup(
    timeOverride?: ConstructorParameters<typeof PanelTimeRange>[0],
    version: 'v1' | 'v2' = 'v2',
    activateDataFirst = false
  ) {
    const source = new DashboardAnnotationsDataLayer({
      name: 'Deployments',
      query: { name: 'Deployments', enable: true, iconColor: 'red' },
    });
    const timeRange = new SceneTimeRange({ from: 'now-7d', to: 'now' });
    const normal = makePanel(1, undefined, version);
    const overridden = makePanel(2, timeOverride, version);
    const layers = new DashboardDataLayerSet({ annotationLayers: [source] });
    const scene = new SceneFlexLayout({
      $timeRange: timeRange,
      $data: layers,
      children: [new SceneFlexItem({ body: normal }), new SceneFlexItem({ body: overridden })],
    });
    deactivate.push(scene.activate(), normal.activate());
    if (activateDataFirst) {
      deactivate.push(overridden.state.$data!.activate());
    }
    deactivate.push(overridden.activate());
    return { source, timeRange, normal, overridden, layers };
  }

  it.each([
    { name: 'V1 relative time', version: 'v1' as const, override: { timeFrom: '72h' }, from: 'now-72h', to: 'now' },
    { name: 'V2 relative time', version: 'v2' as const, override: { timeFrom: '72h' }, from: 'now-72h', to: 'now' },
    {
      name: 'time shift',
      version: 'v2' as const,
      override: { timeFrom: '24h', timeShift: '2d' },
      from: 'now-24h-2d',
      to: 'now-2d',
    },
  ])(
    'keeps annotations within the panel $name when the dashboard range narrows',
    async ({ override, from, to, version }) => {
      const { timeRange, normal, overridden } = setup(override, version);
      await waitFor(() => {
        expect(annotationTexts(normal)).toEqual(['Deployment']);
        expect(annotationTexts(overridden)).toEqual(['Deployment']);
      });

      runRequest.mockClear();
      timeRange.setState({ from: 'now-2d' });
      timeRange.onRefresh();

      await waitFor(() => {
        expect(annotationTexts(normal)).toEqual([]);
        expect(annotationTexts(overridden)).toEqual(['Deployment']);
        expect(runRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ range: expect.objectContaining({ raw: { from, to } }) })
        );
      });
    }
  );

  it('shares one annotation query between panels without time overrides', async () => {
    const { normal, overridden } = setup();
    await waitFor(() => {
      expect(annotationTexts(normal)).toEqual(['Deployment']);
      expect(annotationTexts(overridden)).toEqual(['Deployment']);
    });
    expect(runRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the latest annotations when initialization cancels an earlier request', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    const originalRunRequest = runRequest.getMockImplementation()!;
    const pending: Array<{ request: DataQueryRequest; response: Subject<PanelData> }> = [];
    runRequest.mockImplementation((_ds, request) => {
      const response = new Subject<PanelData>();
      pending.push({ request, response });
      return response;
    });

    try {
      const { overridden } = setup({ timeFrom: '72h' }, 'v2', true);
      await jest.advanceTimersByTimeAsync(1);

      const panelRequests = pending.filter(({ request }) => request.range.raw.from === 'now-72h');
      const cancelled = panelRequests.filter(({ response }) => !response.observed);
      const active = panelRequests.filter(({ response }) => response.observed);
      expect(active.map(({ request }) => request.range.raw)).toEqual([{ from: 'now-72h', to: 'now' }]);
      expect(cancelled.length).toBeGreaterThan(0);
      const panelRequest = active[0];
      panelRequest.response.next({
        state: LoadingState.Done,
        timeRange: panelRequest.request.range,
        series: [toDataFrame([{ time: annotationTime, text: 'Deployment' }])],
      });
      panelRequest.response.complete();
      expect(annotationTexts(overridden)).toEqual(['Deployment']);

      for (const { request, response } of cancelled) {
        response.next({
          state: LoadingState.Done,
          timeRange: request.range,
          series: [toDataFrame([{ time: annotationTime, text: 'Stale deployment' }])],
        });
        response.complete();
      }
      expect(annotationTexts(overridden)).toEqual(['Deployment']);
    } finally {
      runRequest.mockImplementation(originalRunRequest);
      jest.useRealTimers();
    }
  });

  it('applies the annotation toggle to both shared and overridden results', async () => {
    const { source, normal, overridden } = setup({ timeFrom: '72h' });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));

    source.setState({ isEnabled: false });
    expect(annotationTexts(normal)).toEqual([]);
    expect(annotationTexts(overridden)).toEqual([]);

    source.setState({ isEnabled: true });
    await waitFor(() => {
      expect(annotationTexts(normal)).toEqual(['Deployment']);
      expect(annotationTexts(overridden)).toEqual(['Deployment']);
    });
  });

  it('switches annotation ranges when a panel time override is added and removed', async () => {
    const { timeRange, normal, overridden } = setup();
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));
    timeRange.setState({ from: 'now-2d' });
    timeRange.onRefresh();
    await waitFor(() => expect(annotationTexts(normal)).toEqual([]));

    overridden.setState({ $timeRange: new PanelTimeRange({ timeFrom: '72h' }) });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));

    overridden.setState({ $timeRange: undefined });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual([]));
    expect(annotationTexts(normal)).toEqual([]);
  });

  it('updates panel filters and removes deleted annotation queries from overridden panels', async () => {
    const { source, layers, normal, overridden } = setup({ timeFrom: '72h' });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));

    source.setState({ query: { ...source.state.query, filter: { ids: [1] } } });
    await waitFor(() => {
      expect(annotationTexts(normal)).toEqual(['Deployment']);
      expect(annotationTexts(overridden)).toEqual([]);
    });

    source.setState({ query: { ...source.state.query, filter: { ids: [2] } } });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));

    layers.setState({ annotationLayers: [] });
    expect(annotationTexts(normal)).toEqual([]);
    expect(annotationTexts(overridden)).toEqual([]);
  });

  it('stops observing annotation changes while the panel is inactive and reloads on reactivation', async () => {
    const { source, normal, overridden } = setup({ timeFrom: '72h' });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));
    const panelRequests = () => runRequest.mock.calls.filter(([, request]) => request.range.raw.from === 'now-72h');
    expect(panelRequests()).toHaveLength(1);

    deactivate.pop()!();
    source.setState({ isEnabled: false });
    source.setState({ isEnabled: true });
    await waitFor(() => expect(annotationTexts(normal)).toEqual(['Deployment']));
    expect(panelRequests()).toHaveLength(1);

    deactivate.push(overridden.activate());
    await waitFor(() => {
      expect(panelRequests()).toHaveLength(2);
      expect(annotationTexts(overridden)).toEqual(['Deployment']);
    });
  });

  it('keeps annotation controls subscribed when only the overridden panel remains active', async () => {
    const { source, overridden } = setup({ timeFrom: '72h' });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));
    deactivate.shift()!();
    deactivate.shift()!();

    source.setState({ isEnabled: false });
    expect(annotationTexts(overridden)).toEqual([]);
    source.setState({ isEnabled: true });
    await waitFor(() => expect(annotationTexts(overridden)).toEqual(['Deployment']));
  });
});

function makePanel(
  id: number,
  timeOverride?: ConstructorParameters<typeof PanelTimeRange>[0],
  version: 'v1' | 'v2' = 'v2'
) {
  if (version === 'v2') {
    const spec = defaultPanelSpec();
    spec.id = id;
    spec.vizConfig.group = 'timeseries';
    spec.data.spec.queryOptions = { timeFrom: timeOverride?.timeFrom, timeShift: timeOverride?.timeShift };
    return new VizPanel(buildVizPanelState({ kind: 'Panel', spec }));
  }

  return new VizPanel({
    key: `panel-${id}`,
    pluginId: 'timeseries',
    $timeRange: timeOverride ? new PanelTimeRange(timeOverride) : undefined,
    $data: createPanelDataProvider(new PanelModel({ id, type: 'timeseries', targets: [{ refId: 'A' }] }), {}),
  });
}

function annotationTexts(panel: VizPanel) {
  return getQueryRunnerFor(panel)?.state.data?.annotations?.flatMap(
    (frame) => frame.fields.find((field) => field.name === 'text')?.values ?? []
  );
}
