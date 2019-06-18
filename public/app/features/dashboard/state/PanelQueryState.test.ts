import { toDataQueryError, PanelQueryState, getProcessedSeriesData } from './PanelQueryState';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { DataQueryResponse, LoadingState } from '@grafana/ui';
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

describe('getProcessedSeriesData', () => {
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
    const data = getProcessedSeriesData([null, input1, input2, null, null]);
    expect(data.length).toBe(2);
    expect(data[0].fields[0].name).toBe(input1.target);
    expect(data[0].rows).toBe(input1.datapoints);

    // Default name
    expect(data[1].fields[0].name).toEqual('Value');

    // Every colun should have a name and a type
    for (const table of data) {
      for (const column of table.fields) {
        expect(column.name).toBeDefined();
        expect(column.type).toBeDefined();
      }
    }
  });

  it('supports null values from query OK', () => {
    expect(getProcessedSeriesData([null, null, null, null])).toEqual([]);
    expect(getProcessedSeriesData(undefined)).toEqual([]);
    expect(getProcessedSeriesData((null as unknown) as any[])).toEqual([]);
    expect(getProcessedSeriesData([])).toEqual([]);
  });
});

function makeSeriesStub(refId: string) {
  return {
    fields: [{ name: 'a' }],
    rows: [],
    refId,
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
      series: [makeSeriesStub('C')],
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
      series: [makeSeriesStub('D')],
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
      series: [makeSeriesStub('X')],
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
      series: [makeSeriesStub('C')],
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
