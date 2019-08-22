import { toDataQueryError, PanelQueryState, getProcessedDataFrames } from './PanelQueryState';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { LoadingState, getDataFrameRow, DataFrame, dateTime } from '@grafana/data';
import { DataQueryResponse, DataQueryRequest, DataStreamObserver, DataQuery, DataSourceApi } from '@grafana/ui';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

describe('PanelQueryState', () => {
  it('converts anythign to an error', () => {
    let err = toDataQueryError(undefined);
    expect(err.message).toEqual('Query error');

    err = toDataQueryError('STRING ERRROR');
    expect(err.message).toEqual('STRING ERRROR');

    err = toDataQueryError({ message: 'hello' });
    expect(err.message).toEqual('hello');
  });

  it('keeps track of running queries', async () => {
    const state = new PanelQueryState();
    expect(state.getActiveRunner()).toBeFalsy();
    let hasRun = false;
    const dsRunner = new Promise<DataQueryResponse>((resolve, reject) => {
      // The status should be running when we get here
      expect(state.getActiveRunner()).toBeTruthy();
      resolve({ data: ['x', 'y'] });
      hasRun = true;
    });
    const ds = new MockDataSourceApi('test');
    ds.queryResolver = dsRunner;

    // should not actually run for an empty query
    let empty = await state.execute(ds, getQueryOptions({}));
    expect(state.getActiveRunner()).toBeFalsy();
    expect(empty.series.length).toBe(0);
    expect(hasRun).toBeFalsy();

    const query = getQueryOptions({
      targets: [{ hide: true, refId: 'X' }, { hide: true, refId: 'Y' }, { hide: true, refId: 'Z' }],
    });

    empty = await state.execute(ds, query);
    // should not run any hidden queries'
    expect(state.getActiveRunner()).toBeFalsy();
    expect(empty.series.length).toBe(0);
    expect(hasRun).toBeFalsy();

    // Check for the same query
    expect(state.isSameQuery(ds, query)).toBeTruthy();

    // Check for differnet queries
    expect(state.isSameQuery(new MockDataSourceApi('test'), query)).toBeFalsy();
    expect(state.isSameQuery(ds, getQueryOptions({ targets: [{ refId: 'differnet' }] }))).toBeFalsy();
  });
});

interface TestInputEvent {
  info?: string;
  key: string;
  data: DataFrame[];
  panel: string[];
  state: LoadingState;
}

interface TestStreamingQuery extends DataQuery {
  events: TestInputEvent[];
  finalState: LoadingState;
}

describe('Call PanelQuryState directly', () => {
  // A pretend DataSource that streams back our test events
  const ds = {
    query(request: DataQueryRequest<TestStreamingQuery>, observer: DataStreamObserver): Promise<DataQueryResponse> {
      // Execute async code
      const query = request.targets[0];
      for (const event of query.events) {
        observer({
          state: event.state,
          request,
          key: event.key,
          data: event.data,
          unsubscribe: () => {}, // ignore
        });
      }
      return Promise.resolve({
        state: LoadingState.Done,
        data: [],
      });
    },
  } as DataSourceApi;

  it('process list of events', async () => {
    const query: TestStreamingQuery = {
      refId: 'X',
      events: [
        {
          info: 'Event 1',
          key: 'K1',
          data: [makeSeriesStub('A')],
          panel: ['A'],
          state: LoadingState.Streaming,
        },
        {
          info: 'Event 2',
          key: 'K2',
          data: [makeSeriesStub('X')],
          panel: ['A', 'X'],
          state: LoadingState.Done,
        },
        {
          info: 'Event 3',
          key: 'K1',
          data: [makeSeriesStub('A'), makeSeriesStub('B')],
          panel: ['A', 'B', 'X'],
          state: LoadingState.Done,
        },
      ],
      finalState: LoadingState.Done,
    };

    const req = {
      requestId: 'HELLO',
      targets: [query],
      timezone: '',
      range: {
        from: dateTime().subtract(1, 'hour'),
        to: dateTime(),
        raw: { from: '1h', to: 'now' },
      },
      panelId: 1,
      dashboardId: 1,
      interval: '10ms',
      intervalMs: 10,
      maxDataPoints: 1000,
      scopedVars: {},
      startTime: 0,
    };

    return new Promise(resolve => {
      const state = new PanelQueryState();
      let count = 0;
      state.onStreamingDataUpdated = () => {
        const data = state.validateStreamsAndGetPanelData();
        const event = query.events[count++];
        if (event) {
          const ids = data.series.map(frame => frame.refId);
          expect(ids).toEqual(event.panel);
        } else {
          expect(data.state).toBe(query.finalState);
          resolve(); // Done;
        }
      };

      // Execute the query
      state.execute(ds, req, true);
    });
  });
});

describe('getProcessedDataFrame', () => {
  it('converts timeseries to table skipping nulls', () => {
    const input1 = {
      target: 'Field Name',
      datapoints: [[100, 1], [200, 2]],
    };
    const input2 = {
      // without target
      target: '',
      datapoints: [[100, 1], [200, 2]],
    };
    const data = getProcessedDataFrames([null, input1, input2, null, null]);
    expect(data.length).toBe(2);
    expect(data[0].fields[0].name).toBe(input1.target);

    const cmp = [getDataFrameRow(data[0], 0), getDataFrameRow(data[0], 1)];
    expect(cmp).toEqual(input1.datapoints);

    // Default name
    expect(data[1].fields[0].name).toEqual('Value');

    // Every colun should have a name and a type
    for (const table of data) {
      for (const field of table.fields) {
        expect(field.name).toBeDefined();
        expect(field.type).toBeDefined();
      }
    }
  });

  it('supports null values from query OK', () => {
    expect(getProcessedDataFrames([null, null, null, null])).toEqual([]);
    expect(getProcessedDataFrames(undefined)).toEqual([]);
    expect(getProcessedDataFrames((null as unknown) as any[])).toEqual([]);
    expect(getProcessedDataFrames([])).toEqual([]);
  });
});

function makeSeriesStub(refId: string): DataFrame {
  return {
    refId,
    fields: [],
    length: 0,
  };
}

describe('stream handling', () => {
  const state = new PanelQueryState();
  state.onStreamingDataUpdated = () => {
    // nothing
  };
  state.request = {
    requestId: '123',
    range: {
      raw: {
        from: 123, // if string it gets revaluated
      },
    },
  } as any;
  state.response = {
    state: LoadingState.Done,
    series: [makeSeriesStub('A'), makeSeriesStub('B')],
  };

  it('gets the response', () => {
    const data = state.validateStreamsAndGetPanelData();
    expect(data.series.length).toBe(2);
    expect(data.state).toBe(LoadingState.Done);
    expect(data.series[0].refId).toBe('A');
  });

  it('adds a stream event', () => {
    // Post a stream event
    state.dataStreamObserver({
      state: LoadingState.Loading,
      key: 'C',
      request: state.request, // From the same request
      data: [makeSeriesStub('C')],
      unsubscribe: () => {},
    });
    expect(state.streams.length).toBe(1);

    const data = state.validateStreamsAndGetPanelData();
    expect(data.series.length).toBe(3);
    expect(data.state).toBe(LoadingState.Streaming);
    expect(data.series[2].refId).toBe('C');
  });

  it('add another stream event (with a differnet key)', () => {
    // Post a stream event
    state.dataStreamObserver({
      state: LoadingState.Loading,
      key: 'D',
      request: state.request, // From the same request
      data: [makeSeriesStub('D')],
      unsubscribe: () => {},
    });
    expect(state.streams.length).toBe(2);

    const data = state.validateStreamsAndGetPanelData();
    expect(data.series.length).toBe(4);
    expect(data.state).toBe(LoadingState.Streaming);
    expect(data.series[3].refId).toBe('D');
  });

  it('replace the first stream value, but keep the order', () => {
    // Post a stream event
    state.dataStreamObserver({
      state: LoadingState.Loading,
      key: 'C', // The key to replace previous index 2
      request: state.request, // From the same request
      data: [makeSeriesStub('X')],
      unsubscribe: () => {},
    });
    expect(state.streams.length).toBe(2);

    const data = state.validateStreamsAndGetPanelData();
    expect(data.series[2].refId).toBe('X');
  });

  it('ignores streams from a differnet request', () => {
    // Post a stream event
    state.dataStreamObserver({
      state: LoadingState.Loading,
      key: 'Z', // Note with key 'A' it would still overwrite
      request: {
        ...state.request,
        requestId: 'XXX', // Different request and id
      } as any,
      data: [makeSeriesStub('C')],
      unsubscribe: () => {},
    });

    expect(state.streams.length).toBe(2); // no change
    const data = state.validateStreamsAndGetPanelData();
    expect(data.series.length).toBe(4);
  });

  it('removes streams when the query changes', () => {
    state.request = {
      ...state.request,
      requestId: 'somethine else',
    } as any;
    state.response = {
      state: LoadingState.Done,
      series: [makeSeriesStub('F')],
    };
    expect(state.streams.length).toBe(2); // unchanged

    const data = state.validateStreamsAndGetPanelData();
    expect(data.series.length).toBe(1);
    expect(data.series[0].refId).toBe('F');
    expect(state.streams.length).toBe(0); // no streams
  });
});
