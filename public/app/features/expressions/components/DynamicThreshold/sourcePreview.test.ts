import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataFrame, FieldType } from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { dataSource } from '../../ExpressionDatasource';
import { ExpressionQueryType } from '../../types';
import { interpolateSourceQueries } from '../../utils/interpolateSourceQueries';
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
  interpolateSourceQueries: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
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

  it('does not manually refetch when a source first becomes enabled, but refreshes later model changes', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: null,
      isFeatureEnabled: true,
      refetch,
    });
    const { rerender } = renderHook(({ currentQueries }) => useDynamicThresholdSourcePreview(currentQueries, 'A', ''), {
      initialProps: { currentQueries: [] as Array<ReturnType<typeof sourceQuery>> },
    });

    rerender({ currentQueries: [sourceQuery('A', 'first')] });
    await act(async () => Promise.resolve());
    expect(refetch).not.toHaveBeenCalled();

    rerender({ currentQueries: [sourceQuery('A', 'second')] });
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it('does not expose endpoint schema after the source is deleted', () => {
    mockUseSQLSchemas.mockReturnValue({
      schemas: {
        kind: 'SQLSchemaResponse',
        apiVersion: 'query.grafana.app/v0alpha1',
        sqlSchemas: {
          A: {
            columns: [{ name: 'value', mysqlType: 'DOUBLE', dataFrameFieldType: 'float64', nullable: false }],
            sampleRows: [],
          },
        },
      },
      loading: false,
      error: null,
      isFeatureEnabled: true,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    const { result, rerender } = renderHook(
      ({ currentQueries }) => useDynamicThresholdSourcePreview(currentQueries, 'A', ''),
      { initialProps: { currentQueries: [sourceQuery('A')] } }
    );

    expect(result.current.numericFields).toEqual(['value']);
    rerender({ currentQueries: [] });

    expect(result.current.hasSchema).toBe(false);
    expect(result.current.numericFields).toEqual([]);
  });

  it('sends no label-value request when cleanup happens while source interpolation is pending', async () => {
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: null,
      isFeatureEnabled: true,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    const runMetaSQLExprQuery = jest.spyOn(dataSource, 'runMetaSQLExprQuery');
    let resolveInterpolation!: (queries: unknown[]) => void;
    jest
      .mocked(interpolateSourceQueries)
      .mockReturnValueOnce(new Promise((resolve) => (resolveInterpolation = resolve)) as never);
    const { unmount } = renderHook(() => useDynamicThresholdSourcePreview([sourceQuery('A')], 'A', 'region'));

    unmount();
    await act(async () => resolveInterpolation([]));

    expect(runMetaSQLExprQuery).not.toHaveBeenCalled();
  });

  it('passes a cancellation check to the fallback field fetch', async () => {
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: null,
      isFeatureEnabled: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockFetchSQLFields.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderHook(() => useDynamicThresholdSourcePreview([sourceQuery('A')], 'A', ''));

    const options = mockFetchSQLFields.mock.calls[0][2];
    expect(options?.isCancelled?.()).toBe(false);
    unmount();
    expect(options?.isCancelled?.()).toBe(true);
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

  it('falls back to metadata fields when the schema endpoint fails', async () => {
    const endpointError = new Error('schema transport failed');
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: endpointError,
      isFeatureEnabled: true,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockFetchSQLFields.mockResolvedValue([
      { name: 'value', text: 'value', label: 'value', value: 'value', type: 'float64' },
      { name: 'region', text: 'region', label: 'region', value: 'region', type: 'string' },
    ]);

    const queries = [sourceQuery('A')];
    const { result } = renderHook(() => useDynamicThresholdSourcePreview(queries, 'A', ''));

    await waitFor(() => expect(result.current.numericFields).toEqual(['value']));
    expect(result.current.stringFields).toEqual(['region']);
    expect(result.current.error).toBeNull();
    expect(mockFetchSQLFields).toHaveBeenCalledTimes(1);
  });

  it('keeps the endpoint transport error visible when its metadata fallback also fails', async () => {
    const endpointError = new Error('schema transport failed');
    mockUseSQLSchemas.mockReturnValue({
      schemas: null,
      loading: false,
      error: endpointError,
      isFeatureEnabled: true,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockFetchSQLFields.mockRejectedValue(new Error('fallback failed'));

    const queries = [sourceQuery('A')];
    const { result } = renderHook(() => useDynamicThresholdSourcePreview(queries, 'A', ''));

    await waitFor(() => expect(result.current.error).toBe(endpointError));
    expect(result.current.hasSchema).toBe(false);
  });

  describe('request time range', () => {
    const relativeSource = (relativeTimeRange?: { from: number; to: number }): AlertQuery => ({
      ...sourceQuery('A'),
      relativeTimeRange,
    });
    const mockFallbackMode = () => {
      mockUseSQLSchemas.mockReturnValue({
        schemas: null,
        loading: false,
        error: null,
        isFeatureEnabled: false,
        refetch: jest.fn().mockResolvedValue(undefined),
      });
      mockFetchSQLFields.mockResolvedValue([]);
      return jest.spyOn(dataSource, 'runMetaSQLExprQuery').mockResolvedValue({ fields: [] } as unknown as DataFrame);
    };
    const lastSchemaRange = () => mockUseSQLSchemas.mock.calls.at(-1)![0].timeRange!;
    const expectValid = (range: { from: { valueOf(): number }; to: { valueOf(): number } }) => {
      expect(Number.isFinite(range.from.valueOf())).toBe(true);
      expect(Number.isFinite(range.to.valueOf())).toBe(true);
      expect(range.to.valueOf() - range.from.valueOf()).toBeGreaterThan(0);
    };

    afterEach(() => jest.restoreAllMocks());

    it('passes one valid range from the input relativeTimeRange to schema, fallback and label-value requests', async () => {
      const runMeta = mockFallbackMode();
      const queries = [relativeSource({ from: 3600, to: 0 })];
      renderHook(() => useDynamicThresholdSourcePreview(queries, 'A', 'region'));

      await waitFor(() => expect(runMeta).toHaveBeenCalledTimes(1));
      const range = lastSchemaRange();
      expectValid(range);
      expect(range.to.valueOf() - range.from.valueOf()).toBe(3600 * 1000);
      expect(mockFetchSQLFields).toHaveBeenCalledWith({ table: 'A' }, [queries[0].model], {
        range,
        isCancelled: expect.any(Function),
      });
      expect(runMeta.mock.calls[0][1]).toBe(range);
    });

    it.each([
      ['missing', undefined],
      ['non-finite', { from: -Infinity, to: 0 }],
      ['inverted', { from: 0, to: 3600 }],
    ])('uses the default relative range when relativeTimeRange is %s', async (_name, relativeTimeRange) => {
      const runMeta = mockFallbackMode();
      const queries = [relativeSource(relativeTimeRange)];
      renderHook(() => useDynamicThresholdSourcePreview(queries, 'A', 'region'));

      await waitFor(() => expect(runMeta).toHaveBeenCalledTimes(1));
      const range = lastSchemaRange();
      expectValid(range);
      expect(range.to.valueOf() - range.from.valueOf()).toBe(600 * 1000);
      expect(runMeta.mock.calls[0][1]).toBe(range);
    });

    it('keeps the range identity and requests across rerenders with an unchanged source query', async () => {
      const runMeta = mockFallbackMode();
      const initialQueries = [relativeSource({ from: 600, to: 0 })];
      const { rerender } = renderHook(({ queries }) => useDynamicThresholdSourcePreview(queries, 'A', 'region'), {
        initialProps: { queries: initialQueries },
      });
      await waitFor(() => expect(runMeta).toHaveBeenCalledTimes(1));
      const first = lastSchemaRange();

      rerender({ queries: [initialQueries[0], sourceQuery('B')] });

      expect(lastSchemaRange()).toBe(first);
      expect(mockFetchSQLFields).toHaveBeenCalledTimes(1);
      expect(runMeta).toHaveBeenCalledTimes(1);
    });

    it('does not refetch schemas on unrelated rerenders', async () => {
      const refetch = jest.fn().mockResolvedValue(undefined);
      mockUseSQLSchemas.mockReturnValue({
        schemas: null,
        loading: false,
        error: null,
        isFeatureEnabled: true,
        refetch,
      });
      const queries = [relativeSource({ from: 600, to: 0 })];
      const { rerender } = renderHook(() => useDynamicThresholdSourcePreview(queries, 'A', ''));
      const first = lastSchemaRange();

      rerender();

      expect(lastSchemaRange()).toBe(first);
      expect(refetch).not.toHaveBeenCalled();
    });
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
