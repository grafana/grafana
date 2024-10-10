// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/operationUtils.test.ts
import {
  createAggregationOperation,
  createAggregationOperationWithParam,
  getOperationParamId,
  isConflictingSelector,
} from './operationUtils';

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

describe('isConflictingSelector', () => {
  it('returns true if selector is conflicting', () => {
    const newLabel = { label: 'job', op: '!=', value: 'tns/app' };
    const labels = [
      { label: 'job', op: '=', value: 'tns/app' },
      { label: 'job', op: '!=', value: 'tns/app' },
    ];
    expect(isConflictingSelector(newLabel, labels)).toBe(true);
  });

  it('returns false if selector is not complete', () => {
    const newLabel = { label: 'job', op: '', value: 'tns/app' };
    const labels = [
      { label: 'job', op: '=', value: 'tns/app' },
      { label: 'job', op: '', value: 'tns/app' },
    ];
    expect(isConflictingSelector(newLabel, labels)).toBe(false);
  });

  it('returns false if selector is not conflicting', () => {
    const newLabel = { label: 'host', op: '=', value: 'docker-desktop' };
    const labels = [
      { label: 'job', op: '=', value: 'tns/app' },
      { label: 'host', op: '=', value: 'docker-desktop' },
    ];
    expect(isConflictingSelector(newLabel, labels)).toBe(false);
  });
});

describe('getOperationParamId', () => {
  it('Generates correct id for operation param', () => {
    const operationId = 'abc';
    const paramId = 0;
    expect(getOperationParamId(operationId, paramId)).toBe('operations.abc.param.0');
  });
});

describe('renderParams', () => {
  it('should return stringified values for params of type string', () => {
    const model: QueryBuilderOperation = { params: ['testValue'] };
    const def: QueryBuilderOperationDef = { params: [{ type: 'string' }] };
    const result = renderParams(model, def, '');

    expect(result).toEqual(['"testValue"']);
  });

  it('should return original values for non-string params', () => {
    const model: QueryBuilderOperation = { params: [123] };
    const def: QueryBuilderOperationDef = { params: [{ type: 'number' }] };
    const result = renderParams(model, def, '');

    expect(result).toEqual([123]);
  });

  it('should handle missing param definitions gracefully', () => {
    const model: QueryBuilderOperation = { params: ['testValue'] };
    const def: QueryBuilderOperationDef = {};
    const result = renderParams(model, def, '');

    expect(result).toEqual(['testValue']);
  });

  it('should handle undefined params in model gracefully', () => {
    const model: QueryBuilderOperation = { params: undefined }; 
    const def: QueryBuilderOperationDef = { params: [{ type: 'string' }] };
    const result = renderParams(model, def, '');

    expect(result).toEqual([]);
  });

  it('should handle missing paramDef or type correctly', () => {
    const model: QueryBuilderOperation = { params: ['testValue'] };
    const def: QueryBuilderOperationDef = { params: [undefined] }; 
    const result = renderParams(model, def, '');

    expect(result).toEqual(['testValue']);
  });
});
