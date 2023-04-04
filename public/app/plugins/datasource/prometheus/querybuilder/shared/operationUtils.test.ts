import {
  createAggregationOperation,
  createAggregationOperationWithParam,
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
