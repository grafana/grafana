import { toDataQueryError, PanelQueryState } from './PanelQueryState';
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
