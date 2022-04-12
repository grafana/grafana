import { createAggregationOperation, createAggregationOperationWithParam } from './operationUtils';

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
});
