import { QueryBuilderOperation, QueryBuilderOperationDefinition } from '@grafana/plugin-ui';

import {
  createAggregationOperation,
  createAggregationOperationWithParam,
  createRangeOperation,
  createRangeOperationWithGrouping,
  getLineFilterRenderer,
  isConflictingFilter,
  labelFilterRenderer,
  pipelineRenderer,
} from './operationUtils';
import { operationDefinitions } from './operations';
import { LokiOperationId, LokiVisualQueryOperationCategory } from './types';

describe('createRangeOperation', () => {
  it('should create basic range operation without possible grouping', () => {
    expect(createRangeOperation('test_range_operation')).toMatchObject({
      id: 'test_range_operation',
      name: 'Test range operation',
      params: [{ name: 'Range', type: 'string' }],
      defaultParams: ['$__auto'],
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
      defaultParams: ['$__auto'],
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
      defaultParams: ['$__auto', '0.95'],
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
      defaultParams: ['$__auto', '0.95'],
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
      defaultParams: ['$__auto', '0.95', ''],
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
      defaultParams: ['$__auto', '0.95', ''],
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
  const MOCK_MODEL_BACKTICKS = {
    id: '__line_contains',
    params: ['`error`'],
  };

  const MOCK_DEF = undefined as unknown as QueryBuilderOperationDefinition;

  const MOCK_INNER_EXPR = '{job="grafana"}';

  it('getLineFilterRenderer returns a function', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~');
    expect(typeof lineFilterRenderer).toBe('function');
  });

  it('lineFilterRenderer returns the correct query for line contains', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~');
    expect(lineFilterRenderer(MOCK_MODEL, MOCK_DEF, MOCK_INNER_EXPR)).toBe('{job="grafana"} !~ `error`');
  });

  it('lineFilterRenderer returns the correct query for line contains, containing backticks', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~');
    expect(lineFilterRenderer(MOCK_MODEL_BACKTICKS, MOCK_DEF, MOCK_INNER_EXPR)).toBe('{job="grafana"} !~ "`error`"');
  });

  it('lineFilterRenderer returns the correct query for line contains case insensitive', () => {
    const lineFilterRenderer = getLineFilterRenderer('!~', true);
    expect(lineFilterRenderer(MOCK_MODEL_INSENSITIVE, MOCK_DEF, MOCK_INNER_EXPR)).toBe(
      '{job="grafana"} !~ `(?i)ERrOR`'
    );
  });
});

describe('labelFilterRenderer', () => {
  const MOCK_MODEL = { id: '__label_filter', params: ['label', '', 'value'] };
  const MOCK_DEF = undefined as unknown as QueryBuilderOperationDefinition;
  const MOCK_INNER_EXPR = '{job="grafana"}';

  it.each`
    operator | type        | expected
    ${'='}   | ${'string'} | ${'`value`'}
    ${'!='}  | ${'string'} | ${'`value`'}
    ${'=~'}  | ${'string'} | ${'`value`'}
    ${'!~'}  | ${'string'} | ${'`value`'}
    ${'>'}   | ${'number'} | ${'value'}
    ${'>='}  | ${'number'} | ${'value'}
    ${'<'}   | ${'number'} | ${'value'}
    ${'<='}  | ${'number'} | ${'value'}
  `("value should be of type '$type' when operator is: $operator", ({ operator, expected }) => {
    MOCK_MODEL.params[1] = operator;
    expect(labelFilterRenderer(MOCK_MODEL, MOCK_DEF, MOCK_INNER_EXPR)).toBe(
      `{job="grafana"} | label ${operator} ${expected}`
    );
  });
});

describe('isConflictingFilter', () => {
  it('should return true if the operation conflict with another label filter', () => {
    const operation = { id: '__label_filter', params: ['abc', '!=', '123'] };
    const queryOperations = [
      { id: '__label_filter', params: ['abc', '=', '123'] },
      { id: '__label_filter', params: ['abc', '!=', '123'] },
    ];
    expect(isConflictingFilter(operation, queryOperations)).toBe(true);
  });

  it("should return false if the operation doesn't conflict with another label filter", () => {
    const operation = { id: '__label_filter', params: ['abc', '=', '123'] };
    const queryOperations = [
      { id: '__label_filter', params: ['abc', '=', '123'] },
      { id: '__label_filter', params: ['abc', '=', '123'] },
    ];
    expect(isConflictingFilter(operation, queryOperations)).toBe(false);
  });
});

describe('pipelineRenderer', () => {
  it('correctly renders unpack expressions', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Unpack,
      params: [],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Unpack);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | unpack');
  });

  it('correctly renders unpack expressions', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Unpack,
      params: [],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Unpack);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | unpack');
  });

  it('correctly renders empty logfmt expression', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Logfmt,
      params: [],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Logfmt);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | logfmt');
  });

  it('correctly renders logfmt expression', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Logfmt,
      params: [true, false, 'foo', ''],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Logfmt);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | logfmt --strict foo');
  });

  it('correctly renders logfmt expression with multiple params', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Logfmt,
      params: [true, false, 'foo', 'bar', 'baz'],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Logfmt);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | logfmt --strict foo, bar, baz');
  });

  it('correctly renders empty json expression', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Json,
      params: [],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Json);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | json');
  });

  it('correctly renders json expression', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Json,
      params: ['foo', ''],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Json);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | json foo');
  });

  it('correctly renders json expression with multiple params', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Json,
      params: ['foo', 'bar', 'baz'],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Json);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | json foo, bar, baz');
  });

  it('correctly renders keep expression', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Keep,
      params: ['foo', ''],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Keep);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | keep foo');
  });

  it('correctly renders keep expression with multiple params', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Keep,
      params: ['foo', 'bar', 'baz'],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Keep);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | keep foo, bar, baz');
  });

  it('correctly renders drop expression', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Drop,
      params: ['foo', ''],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Drop);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | drop foo');
  });

  it('correctly renders drop expression with multiple params', () => {
    const model: QueryBuilderOperation = {
      id: LokiOperationId.Drop,
      params: ['foo', 'bar', 'baz'],
    };
    const definition = operationDefinitions.find((def) => def.id === LokiOperationId.Drop);
    expect(pipelineRenderer(model, definition!, '{}')).toBe('{} | drop foo, bar, baz');
  });
});

describe('createAggregationOperation', () => {
  it('returns correct aggregation definitions with overrides', () => {
    expect(createAggregationOperation('test_aggregation', { category: 'test_category' })).toMatchObject([
      {
        addOperationHandler: {},
        alternativesKey: 'plain aggregations',
        category: 'test_category',
        defaultParams: [],
        explainHandler: {},
        id: 'test_aggregation',
        name: 'Test aggregation',
        paramChangedHandler: {},
        params: [
          {
            name: 'By label',
            optional: true,
            restParam: true,
            type: 'string',
          },
        ],
        renderer: {},
      },
      {
        alternativesKey: 'aggregations by',
        category: 'test_category',
        defaultParams: [''],
        explainHandler: {},
        hideFromList: true,
        id: '__test_aggregation_by',
        name: 'Test aggregation by',
        paramChangedHandler: {},
        params: [
          {
            editor: {},
            name: 'Label',
            optional: true,
            restParam: true,
            type: 'string',
          },
        ],
        renderer: {},
      },
      {
        alternativesKey: 'aggregations by',
        category: 'test_category',
        defaultParams: [''],
        explainHandler: {},
        hideFromList: true,
        id: '__test_aggregation_without',
        name: 'Test aggregation without',
        paramChangedHandler: {},
        params: [
          {
            name: 'Label',
            optional: true,
            restParam: true,
            type: 'string',
          },
        ],
        renderer: {},
      },
    ]);
  });
});

describe('createAggregationOperationWithParams', () => {
  it('returns correct aggregation definitions with overrides and params', () => {
    expect(
      createAggregationOperationWithParam(
        'test_aggregation',
        {
          params: [{ name: 'K-value', type: 'number' }],
          defaultParams: [5],
        },
        { category: 'test_category' }
      )
    ).toMatchObject([
      {
        addOperationHandler: {},
        alternativesKey: 'plain aggregations',
        category: 'test_category',
        defaultParams: [5],
        explainHandler: {},
        id: 'test_aggregation',
        name: 'Test aggregation',
        paramChangedHandler: {},
        params: [
          { name: 'K-value', type: 'number' },
          { name: 'By label', optional: true, restParam: true, type: 'string' },
        ],
        renderer: {},
      },
      {
        alternativesKey: 'aggregations by',
        category: 'test_category',
        defaultParams: [5, ''],
        explainHandler: {},
        hideFromList: true,
        id: '__test_aggregation_by',
        name: 'Test aggregation by',
        paramChangedHandler: {},
        params: [
          { name: 'K-value', type: 'number' },
          { editor: {}, name: 'Label', optional: true, restParam: true, type: 'string' },
        ],
        renderer: {},
      },
      {
        alternativesKey: 'aggregations by',
        category: 'test_category',
        defaultParams: [5, ''],
        explainHandler: {},
        hideFromList: true,
        id: '__test_aggregation_without',
        name: 'Test aggregation without',
        paramChangedHandler: {},
        params: [
          { name: 'K-value', type: 'number' },
          { name: 'Label', optional: true, restParam: true, type: 'string' },
        ],
        renderer: {},
      },
    ]);
  });
  it('returns correct query string using aggregation definitions with overrides and number type param', () => {
    const def = createAggregationOperationWithParam(
      'test_aggregation',
      {
        params: [{ name: 'K-value', type: 'number' }],
        defaultParams: [5],
      },
      { category: 'test_category' }
    );

    const topKByDefinition = def[1];
    expect(
      topKByDefinition.renderer(
        { id: '__topk_by', params: ['5', 'source', 'place'] },
        def[1],
        'rate({place="luna"} |= `` [5m])'
      )
    ).toBe('test_aggregation by(source, place) (5, rate({place="luna"} |= `` [5m]))');
  });

  it('returns correct query string using aggregation definitions with overrides and string type param', () => {
    const def = createAggregationOperationWithParam(
      'test_aggregation',
      {
        params: [{ name: 'Identifier', type: 'string' }],
        defaultParams: ['count'],
      },
      { category: 'test_category' }
    );

    const countValueDefinition = def[1];
    expect(
      countValueDefinition.renderer(
        { id: 'count_values', params: ['5', 'source', 'place'] },
        def[1],
        'rate({place="luna"} |= `` [5m])'
      )
    ).toBe('test_aggregation by(source, place) ("5", rate({place="luna"} |= `` [5m]))');
  });
});
