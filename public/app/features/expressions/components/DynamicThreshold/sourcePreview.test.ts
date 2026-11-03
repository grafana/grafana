import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataFrame, FieldType } from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';

import { dataSource } from '../../ExpressionDatasource';
import { ExpressionQueryType } from '../../types';
import { fetchSQLFields } from '../../utils/metaSqlExpr';
import { useSQLSchemas } from '../SqlExpressions/hooks/useSQLSchemas';

import {
  classifySchemaFields,
  getDynamicThresholdSourceOptions,
  useDynamicThresholdSourcePreview,
} from './sourcePreview';

jest.mock('../SqlExpressions/hooks/useSQLSchemas');
jest.mock('../../utils/metaSqlExpr', () => ({ fetchSQLFields: jest.fn() }));
jest.mock('../../utils/interpolateSourceQueries', () => ({
  interpolateSourceQueries: (queries: unknown[]) => Promise.resolve(queries),
}));

const mockUseSQLSchemas = jest.mocked(useSQLSchemas);
const mockFetchSQLFields = jest.mocked(fetchSQLFields);

beforeEach(() => {
  jest.clearAllMocks();
});

const sourceQuery = (refId: string, expr = refId) => ({
  refId,
  queryType: '',
  datasourceUid: 'prometheus',
  model: { refId, expr, datasource: { uid: 'prometheus', type: 'prometheus' } },
});

describe('dynamic threshold source preview', () => {
  it('offers datasource-backed queries and excludes expressions and self', () => {
    const options = getDynamicThresholdSourceOptions(
      [
        {
          refId: 'A',
          queryType: '',
          datasourceUid: 'prometheus',
          model: { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
        },
        {
          refId: 'B',
          queryType: '',
          datasourceUid: ExpressionDatasourceRef.uid,
          model: {
            refId: 'B',
            datasource: ExpressionDatasourceRef,
            type: ExpressionQueryType.reduce,
          },
        },
        {
          refId: 'C',
          queryType: '',
          datasourceUid: 'loki',
          model: { refId: 'C', datasource: { uid: 'loki', type: 'loki' } },
        },
      ],
      'C'
    );

    expect(options).toEqual([{ value: 'A', label: 'A' }]);
  });

  it('classifies SDK schema types and frontend FieldType fallbacks', () => {
    const fields = classifySchemaFields([
      { name: 'float', mysqlType: 'DOUBLE', dataFrameFieldType: 'float64', nullable: false },
      { name: 'integer', mysqlType: 'BIGINT', dataFrameFieldType: 'int64', nullable: false },
      { name: 'nullableFloat', mysqlType: 'DOUBLE', dataFrameFieldType: '*float64', nullable: true },
      { name: 'unsigned', mysqlType: 'BIGINT', dataFrameFieldType: 'uint32', nullable: false },
      { name: 'sdkString', mysqlType: 'VARCHAR', dataFrameFieldType: 'string', nullable: false },
      { name: 'nullableString', mysqlType: 'VARCHAR', dataFrameFieldType: '*string', nullable: true },
      { name: 'frontendNumber', mysqlType: 'DOUBLE', dataFrameFieldType: FieldType.number, nullable: false },
      { name: 'frontendString', mysqlType: 'VARCHAR', dataFrameFieldType: FieldType.string, nullable: true },
      { name: 'time', mysqlType: 'DATETIME', dataFrameFieldType: FieldType.time, nullable: false },
    ]);

    expect(fields).toEqual({
      numericFields: ['float', 'integer', 'nullableFloat', 'unsigned', 'frontendNumber'],
      stringFields: ['sdkString', 'nullableString', 'frontendString'],
    });
  });

  it('refetches schema when the input or selected source model changes and hides stale schemas', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockUseSQLSchemas.mockReturnValue({
      schemas: {
        kind: 'SQLSchemaResponse',
        apiVersion: 'query.grafana.app/v0alpha1',
        sqlSchemas: {
          A: {
            columns: [{ name: 'old', mysqlType: 'DOUBLE', dataFrameFieldType: 'float64', nullable: false }],
            sampleRows: [],
          },
        },
      },
      loading: false,
      error: null,
      isFeatureEnabled: true,
      refetch,
    });
    const queries = [sourceQuery('A'), sourceQuery('B')];
    const { result, rerender } = renderHook(
      ({ currentQueries, inputRefId }) => useDynamicThresholdSourcePreview(currentQueries, inputRefId, ''),
      { initialProps: { currentQueries: queries, inputRefId: 'A' } }
    );

    expect(result.current.numericFields).toEqual(['old']);
    rerender({ currentQueries: queries, inputRefId: 'B' });
    expect(result.current.hasSchema).toBe(false);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));

    rerender({ currentQueries: [sourceQuery('A', 'changed'), sourceQuery('B')], inputRefId: 'A' });
    expect(result.current.hasSchema).toBe(false);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(2));
  });

  it('does not expose a stale fallback response after the source model changes', async () => {
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: null,
      isFeatureEnabled: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    let resolveFirst!: (fields: Awaited<ReturnType<typeof fetchSQLFields>>) => void;
    let resolveSecond!: (fields: Awaited<ReturnType<typeof fetchSQLFields>>) => void;
    mockFetchSQLFields
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    const initialQueries = [sourceQuery('A', 'first')];
    const { result, rerender } = renderHook(
      ({ currentQueries }) => useDynamicThresholdSourcePreview(currentQueries, 'A', ''),
      { initialProps: { currentQueries: initialQueries } }
    );

    const changedQueries = [sourceQuery('A', 'second')];
    await act(async () => {
      rerender({ currentQueries: changedQueries });
      await Promise.resolve();
    });
    await act(async () => {
      resolveFirst([{ name: 'stale', text: 'stale', label: 'stale', value: 'stale', type: 'float64' }]);
      await Promise.resolve();
    });
    expect(result.current.hasSchema).toBe(false);

    await act(async () => {
      resolveSecond([{ name: 'current', text: 'current', label: 'current', value: 'current', type: 'float64' }]);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.numericFields).toEqual(['current']));
  });

  it('uses unique metadata request IDs for concurrent and reopened label-value requests', async () => {
    const refetch = jest.fn();
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: null,
      isFeatureEnabled: false,
      refetch,
    });
    mockFetchSQLFields.mockResolvedValue([]);
    const runMeta = jest
      .spyOn(dataSource, 'runMetaSQLExprQuery')
      .mockResolvedValue({ fields: [] } as unknown as DataFrame);

    const firstQueries = [sourceQuery('A')];
    const secondQueries = [sourceQuery('A')];
    const first = renderHook(() => useDynamicThresholdSourcePreview(firstQueries, 'A', 'region'));
    const second = renderHook(() => useDynamicThresholdSourcePreview(secondQueries, 'A', 'region'));
    await waitFor(() => expect(runMeta).toHaveBeenCalledTimes(2));
    const concurrentIds = runMeta.mock.calls.map(([request]) => request.refId);
    expect(new Set(concurrentIds).size).toBe(2);
    expect(mockFetchSQLFields).toHaveBeenCalledTimes(2);

    first.unmount();
    const reopenedQueries = [sourceQuery('A')];
    renderHook(() => useDynamicThresholdSourcePreview(reopenedQueries, 'A', 'region'));
    await waitFor(() => expect(runMeta).toHaveBeenCalledTimes(3));
    expect(runMeta.mock.calls[2][0].refId).not.toBe(concurrentIds[0]);

    second.unmount();
    runMeta.mockRestore();
  });
});
