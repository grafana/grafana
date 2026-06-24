import Prism from 'prismjs';

import { createAssistantContextItem } from '@grafana/assistant';
import {
  AbstractLabelOperator,
  type DataFrame,
  type DataQueryResponse,
  type DataQueryRequest,
  FieldType,
  MutableDataFrame,
  dateTime,
  type PreferredVisualisationType,
} from '@grafana/data';

import { type GrafanaPyroscopeDataQuery } from './dataquery.gen';
import {
  addLabelToQuery,
  enrichDataFrameWithAssistantContentMapper,
  extractLabelMatchers,
  formatLabelName,
  grammar,
  labelNameNeedsQuoting,
  toPromLikeExpr,
} from './utils';

describe('labelNameNeedsQuoting', () => {
  it.each([
    ['service', false],
    ['_private', false],
    ['__name__', false],
    ['k8s.namespace', true],
    ['some-label', true],
    ['http/url', true],
    ['9lives', true],
    ['', true],
  ])('%s => %s', (name, expected) => {
    expect(labelNameNeedsQuoting(name)).toBe(expected);
  });
});

describe('formatLabelName', () => {
  it('returns plain name unchanged', () => {
    expect(formatLabelName('service')).toBe('service');
  });

  it('wraps name containing dot in double quotes', () => {
    expect(formatLabelName('k8s.namespace')).toBe('"k8s.namespace"');
  });

  it('wraps name containing hyphen in double quotes', () => {
    expect(formatLabelName('some-label')).toBe('"some-label"');
  });

  it('escapes double quotes in label names', () => {
    expect(formatLabelName('has"quote')).toBe('"has\\"quote"');
  });

  it('escapes backslashes in label names', () => {
    expect(formatLabelName('has\\backslash')).toBe('"has\\\\backslash"');
  });

  it('escapes both double quotes and backslashes', () => {
    expect(formatLabelName('both"and\\')).toBe('"both\\"and\\\\"');
  });
});

describe('toPromLikeExpr', () => {
  it('serialises plain label names without quoting', () => {
    expect(toPromLikeExpr([{ name: 'service', operator: AbstractLabelOperator.Equal, value: 'foo' }])).toBe(
      '{service="foo"}'
    );
  });

  it('double-quotes UTF-8 label names', () => {
    expect(toPromLikeExpr([{ name: 'k8s.namespace', operator: AbstractLabelOperator.Equal, value: 'prod' }])).toBe(
      '{"k8s.namespace"="prod"}'
    );
  });

  it('handles mixed plain and UTF-8 label names', () => {
    expect(
      toPromLikeExpr([
        { name: 'service', operator: AbstractLabelOperator.Equal, value: 'foo' },
        { name: 'k8s.pod', operator: AbstractLabelOperator.Equal, value: 'bar' },
      ])
    ).toBe('{service="foo", "k8s.pod"="bar"}');
  });

  it('returns empty string for empty matchers', () => {
    expect(toPromLikeExpr([])).toBe('');
  });
});

describe('extractLabelMatchers + grammar round-trip', () => {
  it('parses plain label name', () => {
    const tokens = Prism.tokenize('{service="foo"}', grammar);
    const matchers = extractLabelMatchers(tokens);
    expect(matchers).toHaveLength(1);
    expect(matchers[0].name).toBe('service');
    expect(matchers[0].value).toBe('foo');
  });

  it('parses double-quoted UTF-8 label name and strips quotes', () => {
    const tokens = Prism.tokenize('{"k8s.namespace"="prod"}', grammar);
    const matchers = extractLabelMatchers(tokens);
    expect(matchers).toHaveLength(1);
    expect(matchers[0].name).toBe('k8s.namespace');
    expect(matchers[0].value).toBe('prod');
  });

  it('parses mixed plain and UTF-8 label names', () => {
    const tokens = Prism.tokenize('{service="foo", "k8s.pod"="bar"}', grammar);
    const matchers = extractLabelMatchers(tokens);
    expect(matchers).toHaveLength(2);
    expect(matchers[0].name).toBe('service');
    expect(matchers[1].name).toBe('k8s.pod');
  });

  it('round-trips a UTF-8 label name through parse and serialise', () => {
    const input = '{"k8s.namespace"="prod"}';
    const tokens = Prism.tokenize(input, grammar);
    const matchers = extractLabelMatchers(tokens);
    expect(toPromLikeExpr(matchers)).toBe(input);
  });

  it('parses label name with escaped double quote', () => {
    const tokens = Prism.tokenize('{"has\\"quote"="val"}', grammar);
    const matchers = extractLabelMatchers(tokens);
    expect(matchers).toHaveLength(1);
    expect(matchers[0].name).toBe('has"quote');
    expect(matchers[0].value).toBe('val');
  });

  it('parses label name with escaped backslash', () => {
    const tokens = Prism.tokenize('{"has\\\\backslash"="val"}', grammar);
    const matchers = extractLabelMatchers(tokens);
    expect(matchers).toHaveLength(1);
    expect(matchers[0].name).toBe('has\\backslash');
    expect(matchers[0].value).toBe('val');
  });

  it('round-trips label name with escaped characters', () => {
    const matchers = [{ name: 'has"quote', operator: AbstractLabelOperator.Equal, value: 'val' }];
    const expr = toPromLikeExpr(matchers);
    expect(expr).toBe('{"has\\"quote"="val"}');
    const tokens = Prism.tokenize(expr, grammar);
    const parsed = extractLabelMatchers(tokens);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('has"quote');
  });
});

describe('addLabelToQuery', () => {
  it('adds a UTF-8 key with double-quoted name', () => {
    const result = addLabelToQuery('{}', 'k8s.namespace', 'prod');
    expect(result).toBe('{"k8s.namespace"="prod"}');
  });

  it('replaces an existing UTF-8 key', () => {
    const result = addLabelToQuery('{"k8s.namespace"="old"}', 'k8s.namespace', 'new');
    expect(result).toBe('{"k8s.namespace"="new"}');
  });

  it('adds a UTF-8 key alongside a plain key', () => {
    const result = addLabelToQuery('{service="foo"}', 'k8s.namespace', 'prod');
    expect(result).toBe('{service="foo", "k8s.namespace"="prod"}');
  });
});

// Mock the createContext function
jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn(),
}));

const mockCreateAssistantContextItem = createAssistantContextItem as jest.MockedFunction<
  typeof createAssistantContextItem
>;

describe('enrichDataFrameWithAssistantContentMapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAssistantContextItem.mockImplementation((type, data) => ({
      type,
      data,
      node: { id: 'test-id', type: 'test', name: 'test-node', navigable: true },
      occurrences: [],
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockRequest = (
    targets: Array<Partial<GrafanaPyroscopeDataQuery>> = []
  ): DataQueryRequest<GrafanaPyroscopeDataQuery> => ({
    requestId: 'test-request',
    interval: '1s',
    intervalMs: 1000,
    maxDataPoints: 1000,
    range: {
      from: dateTime('2023-01-01T00:00:00Z'),
      to: dateTime('2023-01-01T01:00:00Z'),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    },
    scopedVars: {},
    timezone: 'UTC',
    app: 'explore',
    startTime: Date.now(),
    targets: targets.map((target, index) => ({
      refId: `A${index}`,
      profileTypeId: 'cpu',
      labelSelector: '{service="test"}',
      groupBy: [],
      queryType: 'profile' as const,
      datasource: {
        uid: 'test-uid',
        type: 'grafana-pyroscope-datasource',
      },
      ...target,
    })) as GrafanaPyroscopeDataQuery[],
  });

  const createMockDataFrame = (refId: string, preferredVisualisationType?: PreferredVisualisationType): DataFrame => {
    const frame = new MutableDataFrame({
      refId,
      fields: [
        { name: 'time', type: FieldType.time, values: [1672531200000] },
        { name: 'value', type: FieldType.number, values: [100] },
      ],
    });

    if (preferredVisualisationType) {
      frame.meta = {
        preferredVisualisationType,
      };
    }

    return frame;
  };

  const createMockResponse = (dataFrames: DataFrame[]): DataQueryResponse => ({
    data: dataFrames,
  });

  describe('when processing flamegraph data frames', () => {
    it('should enrich flamegraph data frame with assistant context', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
        },
      ]);
      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'PyroscopeDatasource');
      const result = mapper(response);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].meta?.custom?.assistantContext).toBeDefined();
      expect(mockCreateAssistantContextItem).toHaveBeenCalledTimes(2);

      // Verify datasource context
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('datasource', {
        datasourceUid: 'test-uid',
      });

      // Verify structured context
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('structured', {
        title: 'Analyze Flame Graph',
        data: {
          start: request.range.from.toISOString(),
          end: request.range.to.toISOString(),
          profile_type_id: 'cpu',
          label_selector: '{service="test"}',
          operation: 'execute',
        },
      });
    });

    it('should preserve existing meta.custom properties', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'memory',
          labelSelector: '{app="backend"}',
        },
      ]);
      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      dataFrame.meta = {
        preferredVisualisationType: 'flamegraph',
        custom: {
          existingProperty: 'value',
        },
      };

      const response = createMockResponse([dataFrame]);
      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data[0].meta?.custom?.existingProperty).toBe('value');
      expect(result.data[0].meta?.custom?.assistantContext).toBeDefined();
    });

    it('should handle multiple flamegraph data frames', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test1"}',
        },
        {
          refId: 'A1',
          profileTypeId: 'memory',
          labelSelector: '{service="test2"}',
        },
      ]);

      const dataFrames = [createMockDataFrame('A0', 'flamegraph'), createMockDataFrame('A1', 'flamegraph')];
      const response = createMockResponse(dataFrames);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].meta?.custom?.assistantContext).toBeDefined();
      expect(result.data[1].meta?.custom?.assistantContext).toBeDefined();
      expect(mockCreateAssistantContextItem).toHaveBeenCalledTimes(4); // 2 contexts per frame
    });
  });

  describe('when processing non-flamegraph data frames', () => {
    it('should not modify data frames without flamegraph visualization type', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
        },
      ]);
      const dataFrame = createMockDataFrame('A0', 'table');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data[0].meta?.custom?.assistantContext).toBeUndefined();
      expect(mockCreateAssistantContextItem).not.toHaveBeenCalled();
    });
  });

  describe('when handling edge cases', () => {
    it('should not add context data frame without matching query target', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
        },
      ]);
      const dataFrame = createMockDataFrame('B0', 'flamegraph'); // Different refId
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data[0]).toBe(dataFrame); // Should remain unchanged
      expect(mockCreateAssistantContextItem).not.toHaveBeenCalled();
    });

    it('should not add context when query has no datasource information', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
          datasource: undefined,
        },
      ]);
      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data[0]).toBe(dataFrame); // Should remain unchanged
      expect(mockCreateAssistantContextItem).not.toHaveBeenCalled();
    });

    it('should not add context if query has incomplete datasource information', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
          datasource: {
            uid: 'test-uid',
            // Missing type
          },
        },
      ]);
      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data[0]).toBe(dataFrame); // Should remain unchanged
      expect(mockCreateAssistantContextItem).not.toHaveBeenCalled();
    });

    it('should not add context with empty response data', () => {
      const request = createMockRequest([]);
      const response = createMockResponse([]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data).toHaveLength(0);
      expect(mockCreateAssistantContextItem).not.toHaveBeenCalled();
    });

    it('should handle mixed data frame types', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
        },
        {
          refId: 'A1',
          profileTypeId: 'memory',
          labelSelector: '{service="test2"}',
        },
      ]);

      const dataFrames = [
        createMockDataFrame('A0', 'flamegraph'),
        createMockDataFrame('A1', 'table'),
        createMockDataFrame('A0', 'flamegraph'), // Another flamegraph with same refId
      ];
      const response = createMockResponse(dataFrames);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      const result = mapper(response);

      expect(result.data).toHaveLength(3);
      expect(result.data[0].meta?.custom?.assistantContext).toBeDefined(); // Flamegraph
      expect(result.data[1].meta?.custom?.assistantContext).toBeUndefined(); // Table
      expect(result.data[2].meta?.custom?.assistantContext).toBeDefined(); // Flamegraph
      expect(mockCreateAssistantContextItem).toHaveBeenCalledTimes(4); // 2 contexts for each flamegraph
    });
  });

  describe('context creation', () => {
    it('should create context with correct time range values', () => {
      const fromTime = dateTime('2023-06-15T10:00:00Z');
      const toTime = dateTime('2023-06-15T11:00:00Z');

      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
        },
      ]);
      request.range.from = fromTime;
      request.range.to = toTime;

      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      mapper(response);

      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('structured', {
        title: 'Analyze Flame Graph',
        data: {
          start: fromTime.toISOString(),
          end: toTime.toISOString(),
          profile_type_id: 'cpu',
          label_selector: '{service="test"}',
          operation: 'execute',
        },
      });
    });

    it('should include profile_id when profileIdSelector is set', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
          profileIdSelector: ['7c9e6679-7425-40de-944b-e07fc1f90ae7'],
        },
      ]);

      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      mapper(response);

      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('structured', {
        title: 'Analyze Flame Graph',
        data: {
          start: request.range.from.toISOString(),
          end: request.range.to.toISOString(),
          profile_type_id: 'cpu',
          label_selector: '{service="test"}',
          operation: 'execute',
          profile_id: ['7c9e6679-7425-40de-944b-e07fc1f90ae7'],
        },
      });
    });

    it('should not include profile_id when profileIdSelector is empty', () => {
      const request = createMockRequest([
        {
          refId: 'A0',
          profileTypeId: 'cpu',
          labelSelector: '{service="test"}',
          profileIdSelector: [],
        },
      ]);

      const dataFrame = createMockDataFrame('A0', 'flamegraph');
      const response = createMockResponse([dataFrame]);

      const mapper = enrichDataFrameWithAssistantContentMapper(request, 'TestDatasource');
      mapper(response);

      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('structured', {
        title: 'Analyze Flame Graph',
        data: {
          start: request.range.from.toISOString(),
          end: request.range.to.toISOString(),
          profile_type_id: 'cpu',
          label_selector: '{service="test"}',
          operation: 'execute',
        },
      });
    });
  });
});
