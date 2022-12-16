import { QueryBuilderOperationDef } from '../../prometheus/querybuilder/shared/types';

import { createRangeOperation, createRangeOperationWithGrouping, getLineFilterRenderer } from './operationUtils';
import { LokiVisualQueryOperationCategory } from './types';

describe('createRangeOperation', () => {
  it('should create basic range operation without possible grouping', () => {
    expect(createRangeOperation('test_range_operation')).toMatchObject({
      id: 'test_range_operation',
      name: 'Test range operation',
      params: [{ name: 'Range', type: 'string' }],
      defaultParams: ['$__interval'],
      alternativesKey: 'range function',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
    });
  });

  it('should create basic range operation with possible grouping', () => {
    expect(createRangeOperation('test_range_operation', true)).toMatchObject({
      id: 'test_range_operation',
      name: 'Test range operation',
      params: [
        { name: 'Range', type: 'string' },
        {
          name: 'By label',
          type: 'string',
          restParam: true,
          optional: true,
        },
      ],
      defaultParams: ['$__interval'],
      alternativesKey: 'range function',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
    });
  });

  it('should create range operation for quantile_over_time', () => {
    expect(createRangeOperation('quantile_over_time', true)).toMatchObject({
      id: 'quantile_over_time',
      name: 'Quantile over time',
      params: [
        { name: 'Range', type: 'string' },
        { name: 'Quantile', type: 'number' },
        { name: 'By label', type: 'string', restParam: true, optional: true },
      ],
      defaultParams: ['$__interval', '0.95'],
      alternativesKey: 'range function',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
    });
  });
});

describe('createRangeOperationWithGrouping', () => {
  it('returns correct operation definitions with overrides and params', () => {
    const operations = createRangeOperationWithGrouping('quantile_over_time');
    expect(operations).toHaveLength(3);
    expect(operations[0]).toMatchObject({
      id: 'quantile_over_time',
      name: 'Quantile over time',
      params: [
        { name: 'Range', type: 'string' },
        { name: 'Quantile', type: 'number' },
        { name: 'By label', type: 'string', restParam: true, optional: true },
      ],
      defaultParams: ['$__interval', '0.95'],
      alternativesKey: 'range function',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
    });

    expect(operations[1]).toMatchObject({
      id: '__quantile_over_time_by',
      name: 'Quantile over time by',
      params: [
        { name: 'Range', type: 'string' },
        { name: 'Quantile', type: 'number' },
        { name: 'Label', type: 'string', restParam: true, optional: true },
      ],
      defaultParams: ['$__interval', '0.95', ''],
      alternativesKey: 'range function with grouping',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
    });

    expect(operations[2]).toMatchObject({
      id: '__quantile_over_time_without',
      name: 'Quantile over time without',
      params: [
        { name: 'Range', type: 'string' },
        { name: 'Quantile', type: 'number' },
        { name: 'Label', type: 'string', restParam: true, optional: true },
      ],
      defaultParams: ['$__interval', '0.95', ''],
      alternativesKey: 'range function with grouping',
      category: LokiVisualQueryOperationCategory.RangeFunctions,
    });
  });

  it('returns correct query string using range operation definitions for quantile_over_time with by grouping', () => {
    const operations = createRangeOperationWithGrouping('quantile_over_time');
    const query = operations[1].renderer(
      { id: '__quantile_over_time_by', params: ['[5m]', '0.95', 'source', 'place'] },
      operations[1],
      '{job="grafana"}'
    );
    expect(query).toBe('quantile_over_time(0.95, {job="grafana"} [[5m]]) by (source, place)');
  });

  it('returns correct query string using range operation definitions for quantile_over_time with without grouping', () => {
    const operations = createRangeOperationWithGrouping('quantile_over_time');
    const query = operations[2].renderer(
      { id: '__quantile_over_time_without', params: ['[$__interval]', '0.91', 'source', 'place'] },
      operations[2],
      '{job="grafana"}'
    );
    expect(query).toBe('quantile_over_time(0.91, {job="grafana"} [[$__interval]]) without (source, place)');
  });

  it('returns correct query string using range operation definitions for avg_over_time with without grouping', () => {
    const operations = createRangeOperationWithGrouping('avg_over_time');
    const query = operations[2].renderer(
      { id: '__avg_over_time_without', params: ['[$__interval]', 'source'] },
      operations[2],
      '{job="grafana"}'
    );
    expect(query).toBe('avg_over_time({job="grafana"} [[$__interval]]) without (source)');
  });
});

describe('getLineFilterRenderer', () => {
  const MOCK_MODEL = {
    id: '__line_contains',
    params: ['error'],
  };
  const MOCK_MODEL_INSENSITIVE = {
    id: '__line_contains_case_insensitive',
    params: ['ERrOR'],
  };

  const MOCK_DEF = undefined as unknown as QueryBuilderOperationDef;

  const MOCK_INNER_EXPR = '{job="grafana"}';

  it('getLineFilterRenderer returns a function', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~');
    expect(typeof lineFilterRenderer).toBe('function');
  });

  it('lineFilterRenderer returns the correct query for line contains', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~');
    expect(lineFilterRenderer(MOCK_MODEL, MOCK_DEF, MOCK_INNER_EXPR)).toBe('{job="grafana"} !~ `error`');
  });

  it('lineFilterRenderer returns the correct query for line contains case insensitive', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~', true);
    expect(lineFilterRenderer(MOCK_MODEL_INSENSITIVE, MOCK_DEF, MOCK_INNER_EXPR)).toBe(
      '{job="grafana"} !~ `(?i)ERrOR`'
    );
  });
});
