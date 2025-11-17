import { createAssistantContextItem } from '@grafana/assistant';
import {
  DataFrame,
  DataQueryResponse,
  DataQueryRequest,
  FieldType,
  MutableDataFrame,
  dateTime,
  PreferredVisualisationType,
} from '@grafana/data';

import { GrafanaPyroscopeDataQuery } from './dataquery.gen';
import { enrichDataFrameWithAssistantContentMapper } from './utils';

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
          start: request.range.from.valueOf(),
          end: request.range.to.valueOf(),
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
          start: fromTime.valueOf(),
          end: toTime.valueOf(),
          profile_type_id: 'cpu',
          label_selector: '{service="test"}',
          operation: 'execute',
        },
      });
    });
  });
});
