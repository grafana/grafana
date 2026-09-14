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
    // toStrictEqual, not toEqual: the latter treats an undefined property as absent, so the inFlight
    // expectation below would hold whether or not the key was set.
    expect(captured?.request).toStrictEqual({
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

  it('omits errors when the query did not error', () => {
    // An absent key has to read as "nothing went wrong", not "nobody looked".
    expect(capturePanelData(panel(), runnerWith(panelData()))?.errors).toBeUndefined();
  });

  it('records why the frames are missing when the plugin frontend threw', () => {
    // The case the artifact is weakest without: runRequest's catchError emits state Error with no series
    // and only the deprecated singular error set. Empty frames against a healthy querydata.json localise
    // the loss to the frontend, but the reason lives nowhere else -- traffic.har recorded a successful
    // round trip and the server never saw a browser-side exception.
    const captured = capturePanelData(
      panel(),
      runnerWith(
        panelData({
          state: LoadingState.Error,
          series: [],
          error: { refId: 'A', message: 'Cannot read properties of undefined (reading "result")' },
        })
      )
    );

    expect(captured?.frames).toEqual([]);
    expect(captured?.errors).toEqual([
      expect.objectContaining({ refId: 'A', message: 'Cannot read properties of undefined (reading "result")' }),
    ]);
  });

  it('records the stack of the exception the plugin frontend threw', () => {
    // toDataQueryError hands back the thrown object, so a real Error arrives here with its stack -- the only
    // field in the bundle that names the frame the data was lost in. querydata.json, traffic.har and the
    // server logs all have nothing to say about a browser-side throw.
    const thrown = Object.assign(new Error('Cannot read properties of undefined (reading "result")'), {
      refId: 'A',
    });
    const captured = capturePanelData(
      panel(),
      runnerWith(panelData({ state: LoadingState.Error, series: [], error: thrown }))
    );

    expect(captured?.errors?.[0].stack).toContain('capturePanelData.test.ts');
  });

  it('caps a runaway stack and marks where it was cut', () => {
    // A recursion blows past any sane frame count, and the frames past the cap repeat the ones before it.
    // Cutting from the far end keeps the throw site, which comes first.
    const thrown = Object.assign(new Error('Maximum call stack size exceeded'), {
      stack: `Error: Maximum call stack size exceeded\n${'    at process (module.js:1:1)\n'.repeat(500)}`,
    });
    const captured = capturePanelData(
      panel(),
      runnerWith(panelData({ state: LoadingState.Error, series: [], error: thrown }))
    );

    const stack = captured?.errors?.[0].stack ?? '';
    expect(stack).toMatch(/^Error: Maximum call stack size exceeded\n {4}at process/);
    // Marked, so a stack ending mid-frame reads as truncated rather than as the throw having no deeper frames.
    expect(stack).toContain('… [stack truncated at 4096 characters]');
    expect(stack.length).toBeLessThan(4200);
  });

  it('omits the stack for a server-reported query error, which never had one', () => {
    const captured = capturePanelData(
      panel(),
      runnerWith(
        panelData({
          state: LoadingState.Error,
          series: [],
          errors: [{ refId: 'A', message: 'upstream exploded', status: 502 }],
        })
      )
    );

    expect(captured?.errors?.[0].stack).toBeUndefined();
  });

  it('prefers the errors array over the deprecated singular error', () => {
    const captured = capturePanelData(
      panel(),
      runnerWith(
        panelData({
          state: LoadingState.Error,
          errors: [
            { refId: 'A', message: 'upstream exploded', status: 502, statusText: 'Bad Gateway', traceId: 'abc123' },
            { refId: 'B', message: 'also this one' },
          ],
          error: { message: 'upstream exploded' },
        })
      )
    );

    expect(captured?.errors).toEqual([
      {
        refId: 'A',
        message: 'upstream exploded',
        status: 502,
        statusText: 'Bad Gateway',
        traceId: 'abc123',
        type: undefined,
        detail: undefined,
      },
      expect.objectContaining({ refId: 'B', message: 'also this one' }),
    ]);
  });

  it('copies scalar fields out rather than embedding the thrown object', () => {
    // toDataQueryError returns *the object that was thrown* with a message attached, so PanelData.error is
    // not the tidy DataQueryError its type claims -- a fetch/axios error brings a circular config along.
    // Embedding it would fail the caller's serialization guard and cost the frames too, to explain why the
    // frames are missing.
    const thrown: Record<string, unknown> = { refId: 'A', message: 'Request failed', status: 500 };
    thrown.config = { adapter: () => undefined, self: thrown };
    const captured = capturePanelData(
      panel(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runnerWith(panelData({ state: LoadingState.Error, series: [], error: thrown as any }))
    );

    expect(() => JSON.stringify(captured)).not.toThrow();
    expect(captured?.errors).toEqual([
      {
        refId: 'A',
        message: 'Request failed',
        status: 500,
        statusText: undefined,
        traceId: undefined,
        type: undefined,
        detail: undefined,
      },
    ]);
  });

  it('records the server detail a development-mode Grafana returns', () => {
    const captured = capturePanelData(
      panel(),
      runnerWith(
        panelData({
          state: LoadingState.Error,
          errors: [
            {
              refId: 'A',
              message: 'Query data error',
              data: { message: 'Query data error', error: 'pq: relation "foo" does not exist' },
            },
          ],
        })
      )
    );

    expect(captured?.errors?.[0].detail).toBe('pq: relation "foo" does not exist');
  });
});

describe('capturePanelDataFailure', () => {
  it('records the failure with the panel identity and no frames', () => {
    const failure = capturePanelDataFailure(panel(), new Error('circular structure'));

    expect(failure).toMatchObject({
      version: 1,
      panelKey: 'panel-1',
      pluginId: 'timeseries',
      captureError: 'circular structure',
    });
    // No frames key: an empty one would read as "the frontend was holding nothing", which is the
    // frontend-loss misreading this artifact exists to settle.
    expect(failure).not.toHaveProperty('frames');
  });

  it('records the stack of what the capture threw, which localises the fault to this code', () => {
    // "circular structure" says a capture broke and nothing more; every candidate for breaking it is a
    // line in capturePanelData. Nothing else in the bundle records a browser-side throw.
    const failure = capturePanelDataFailure(panel(), new Error('circular structure'));

    expect(failure.captureStack).toContain('capturePanelData.test.ts');
  });

  it('caps the stack of what the capture threw', () => {
    const thrown = Object.assign(new Error('circular structure'), {
      stack: `Error: circular structure\n${'    at serialize (module.js:1:1)\n'.repeat(500)}`,
    });

    const stack = capturePanelDataFailure(panel(), thrown).captureStack ?? '';
    expect(stack).toContain('… [stack truncated at 4096 characters]');
    expect(stack.length).toBeLessThan(4200);
  });

  it('stringifies a non-Error throw, which has no stack to record', () => {
    const failure = capturePanelDataFailure(panel(), 'plugin exploded');

    expect(failure.captureError).toBe('plugin exploded');
    expect(failure.captureStack).toBeUndefined();
  });
});
