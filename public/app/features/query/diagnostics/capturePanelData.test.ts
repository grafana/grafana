import {
  dateTime,
  LoadingState,
  toDataFrame,
  type DataQueryRequest,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { capturePanelData, capturePanelDataFailure } from './capturePanelData';

const timeRange: TimeRange = {
  from: dateTime(1_700_000_000_000),
  to: dateTime(1_700_000_300_000),
  raw: { from: 'now-5m', to: 'now' },
};

function panel(): VizPanel {
  return new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Panel' });
}

// Only the fields capturePanelData reads; a full DataQueryRequest would be noise here.
function request(overrides: Partial<DataQueryRequest> = {}): DataQueryRequest {
  return {
    range: timeRange,
    intervalMs: 15_000,
    maxDataPoints: 800,
    endTime: 1_700_000_300_100,
    ...overrides,
  } as DataQueryRequest;
}

function runnerWith(data: PanelData | undefined): SceneQueryRunner {
  const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
  if (data) {
    runner.setState({ data });
  }
  return runner;
}

function panelData(overrides: Partial<PanelData> = {}): PanelData {
  return {
    state: LoadingState.Done,
    series: [toDataFrame({ refId: 'A', name: 'host-a', fields: [{ name: 'value', values: [1, 2] }] })],
    timeRange,
    request: request(),
    ...overrides,
  };
}

describe('capturePanelData', () => {
  it('returns undefined when the panel has no query runner', () => {
    expect(capturePanelData(panel(), undefined)).toBeUndefined();
  });

  it('returns undefined when the query runner has no resolved data', () => {
    // The caller then omits panelData entirely, so an absent paneldata.json means "nothing to capture"
    // rather than "capture failed" (which capturePanelDataFailure records instead).
    expect(capturePanelData(panel(), runnerWith(undefined))).toBeUndefined();
  });

  it('captures the frames as DataFrameJSON alongside the panel identity and loading state', () => {
    const captured = capturePanelData(panel(), runnerWith(panelData()));

    expect(captured).toMatchObject({
      version: 1,
      panelKey: 'panel-1',
      pluginId: 'timeseries',
      state: LoadingState.Done,
    });
    // DataFrameJSON is the same encoding the backend uses for querydata.json, so the two artifacts can
    // be diffed field-for-field.
    expect(captured?.frames).toEqual([
      {
        schema: expect.objectContaining({
          refId: 'A',
          name: 'host-a',
          fields: [expect.objectContaining({ name: 'value' })],
        }),
        data: { values: [[1, 2]] },
      },
    ]);
  });

  it('records the request the frames were produced from', () => {
    const captured = capturePanelData(panel(), runnerWith(panelData()));

    // querydata.json is a server-side re-run at its own resolution, so without this a step or point-count
    // difference is indistinguishable from data the plugin's frontend lost.
    expect(captured?.request).toEqual({
      from: 1_700_000_000_000,
      to: 1_700_000_300_000,
      intervalMs: 15_000,
      maxDataPoints: 800,
      inFlight: undefined,
    });
  });

  it('omits the request when the panel has data but no recorded request', () => {
    const captured = capturePanelData(panel(), runnerWith(panelData({ request: undefined })));

    // e.g. frames supplied by a snapshot rather than a query: better omitted than sent half-empty.
    expect(captured?.request).toBeUndefined();
    expect(captured?.frames).toHaveLength(1);
  });

  it('marks a request that has not returned yet, whose frames are therefore from the previous run', () => {
    // runRequest emits a loading packet carrying the new request and no series 200ms into every query,
    // and preProcessPanelData refills those empty series from the last result. So mid-refresh the frames
    // and the request come from different runs, which would otherwise read as a resolution mismatch --
    // or, on a first load, as frames the plugin's frontend lost.
    const captured = capturePanelData(
      panel(),
      runnerWith(panelData({ state: LoadingState.Loading, request: request({ endTime: undefined }) }))
    );

    expect(captured?.request?.inFlight).toBe(true);
  });

  it('does not mark a request that has already returned a packet', () => {
    // endTime is stamped when the first packet arrives, so a still-Loading multi-packet response is this
    // request's own partial output and the frames do belong to it.
    const captured = capturePanelData(panel(), runnerWith(panelData({ state: LoadingState.Loading })));

    expect(captured?.request?.inFlight).toBeUndefined();
  });
});

describe('capturePanelDataFailure', () => {
  it('records the failure with the panel identity and no frames', () => {
    const failure = capturePanelDataFailure(panel(), new Error('circular structure'));

    expect(failure).toEqual({
      version: 1,
      panelKey: 'panel-1',
      pluginId: 'timeseries',
      captureError: 'circular structure',
    });
    // No frames key: an empty one would read as "the frontend was holding nothing", which is the
    // frontend-loss misreading this artifact exists to settle.
    expect(failure).not.toHaveProperty('frames');
  });

  it('stringifies a non-Error throw', () => {
    expect(capturePanelDataFailure(panel(), 'plugin exploded').captureError).toBe('plugin exploded');
  });
});
