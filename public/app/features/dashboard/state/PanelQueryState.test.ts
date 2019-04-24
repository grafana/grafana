import { toDataQueryError, PanelQueryState, getProcessedSeriesData } from './PanelQueryState';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { DataQueryResponse } from '@grafana/ui';
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
    expect(state.isRunning()).toBeFalsy();
    let hasRun = false;
    const dsRunner = new Promise<DataQueryResponse>((resolve, reject) => {
      // The status should be running when we get here
      expect(state.isRunning()).toBeTruthy();
      resolve({ data: ['x', 'y'] });
      hasRun = true;
    });
    const ds = new MockDataSourceApi('test');
    ds.queryResolver = dsRunner;

    // should not actually run for an empty query
    let empty = await state.execute(ds, getQueryOptions({}));
    expect(state.isRunning()).toBeFalsy();
    expect(empty.series.length).toBe(0);
    expect(hasRun).toBeFalsy();

    empty = await state.execute(
      ds,
      getQueryOptions({ targets: [{ hide: true, refId: 'X' }, { hide: true, refId: 'Y' }, { hide: true, refId: 'Z' }] })
    );
    // should not run any hidden queries'
    expect(state.isRunning()).toBeFalsy();
    expect(empty.series.length).toBe(0);
    expect(hasRun).toBeFalsy();
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
