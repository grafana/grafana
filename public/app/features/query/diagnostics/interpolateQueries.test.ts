import { type DataSourceApi } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { interpolateDiagnosticsQueries } from './interpolateQueries';

const getDataSourceInstance = jest.fn();

jest.mock('@grafana/runtime/unstable', () => ({
  getDataSourceInstance: (...args: unknown[]) => getDataSourceInstance(...args),
}));

// A datasource that replaces "$var" in the query's `expr` field with "resolved", standing in for a
// real backend datasource's applyTemplateVariables-backed interpolateVariablesInQueries.
function fakeDatasource(): Partial<DataSourceApi> {
  return {
    interpolateVariablesInQueries: (queries: DataQuery[]) =>
      queries.map((q) => ({ ...q, expr: (q as { expr?: string }).expr?.replace('$var', 'resolved') })),
  };
}

describe('interpolateDiagnosticsQueries', () => {
  beforeEach(() => {
    getDataSourceInstance.mockReset();
  });

  it('interpolates each query with its own datasource', async () => {
    getDataSourceInstance.mockResolvedValue(fakeDatasource());

    const result = await interpolateDiagnosticsQueries(
      [{ refId: 'A', datasource: { uid: 'prom', type: 'prometheus' }, expr: 'up{job="$var"}' } as DataQuery],
      { __sceneObject: { value: {} } }
    );

    expect(result).toEqual([
      { refId: 'A', datasource: { uid: 'prom', type: 'prometheus' }, expr: 'up{job="resolved"}' },
    ]);
  });

  it('resolves each query against its own datasource so mixed-datasource panels interpolate independently', async () => {
    getDataSourceInstance.mockImplementation((ref: { uid: string }) =>
      Promise.resolve(ref.uid === 'no-interp' ? {} : fakeDatasource())
    );

    const result = await interpolateDiagnosticsQueries(
      [
        { refId: 'A', datasource: { uid: 'prom', type: 'prometheus' }, expr: '$var' } as DataQuery,
        { refId: 'B', datasource: { uid: 'no-interp', type: 'other' }, expr: '$var' } as DataQuery,
      ],
      { __sceneObject: { value: {} } }
    );

    // A's datasource interpolates; B's datasource has no interpolateVariablesInQueries so it is
    // returned unchanged. Order is preserved.
    expect(result[0]).toMatchObject({ refId: 'A', expr: 'resolved' });
    expect(result[1]).toMatchObject({ refId: 'B', expr: '$var' });
  });

  it('passes expression queries through unchanged without resolving a datasource', async () => {
    const exprQuery = { refId: 'C', datasource: { uid: '__expr__', type: '__expr__' }, expression: '$A' } as DataQuery;

    const result = await interpolateDiagnosticsQueries([exprQuery], { __sceneObject: { value: {} } });

    expect(result[0]).toBe(exprQuery);
    expect(getDataSourceInstance).not.toHaveBeenCalled();
  });

  it('falls back to the raw query when the datasource cannot be resolved', async () => {
    getDataSourceInstance.mockRejectedValue(new Error('not found'));
    const query = { refId: 'A', datasource: { uid: 'gone', type: 'prometheus' }, expr: '$var' } as DataQuery;

    const result = await interpolateDiagnosticsQueries([query], { __sceneObject: { value: {} } });

    expect(result[0]).toBe(query);
  });

  it('forwards scopedVars and adhoc filters to the datasource', async () => {
    const spy = jest.fn().mockReturnValue([{ refId: 'A' }]);
    getDataSourceInstance.mockResolvedValue({ interpolateVariablesInQueries: spy });
    const scopedVars = { __sceneObject: { value: {} } };
    const filters = [{ key: 'env', operator: '=', value: 'prod' }];

    await interpolateDiagnosticsQueries(
      [{ refId: 'A', datasource: { uid: 'prom', type: 'prometheus' } } as DataQuery],
      scopedVars,
      filters
    );

    expect(spy).toHaveBeenCalledWith(
      [{ refId: 'A', datasource: { uid: 'prom', type: 'prometheus' } }],
      scopedVars,
      filters
    );
  });
});
