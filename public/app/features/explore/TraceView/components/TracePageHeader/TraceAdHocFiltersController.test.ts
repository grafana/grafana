import { SelectableValue, TraceSearchProps } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';

import { getTraceTagKeys, getTraceTagValues } from '../../utils/tags';
import { Trace, TraceSpan } from '../types/trace';

import { TraceAdHocFiltersController } from './TraceAdHocFiltersController';

// Mock the tag utilities
jest.mock('../../utils/tags', () => ({
  getTraceTagKeys: jest.fn(),
  getTraceTagValues: jest.fn(),
}));

// Mock i18n
jest.mock('@grafana/i18n', () => ({
  t: (key: string, defaultValue: string) => defaultValue,
}));

const mockGetTraceTagKeys = getTraceTagKeys as jest.MockedFunction<typeof getTraceTagKeys>;
const mockGetTraceTagValues = getTraceTagValues as jest.MockedFunction<typeof getTraceTagValues>;

describe('TraceAdHocFiltersController', () => {
  let mockTrace: Trace;
  let mockSearch: TraceSearchProps;
  let mockSetSearch: jest.Mock;
  let mockWip: AdHocFilterWithLabels | undefined;
  let mockSetWip: jest.Mock;

  beforeEach(() => {
    // Create a minimal mock trace
    mockTrace = {
      traceID: 'trace1',
      spans: [
        {
          spanID: 'span1',
          operationName: 'operation1',
          process: {
            serviceName: 'service1',
            tags: [],
          },
          tags: [
            { key: 'http.method', value: 'GET' },
            { key: 'http.status_code', value: 200 },
          ],
          logs: [],
        } as unknown as TraceSpan,
      ],
      duration: 1000,
      startTime: 0,
      endTime: 1000,
      processes: {},
      traceName: 'test-trace',
      services: [],
    };

    mockSearch = {
      serviceNameOperator: '=',
      spanNameOperator: '=',
      fromOperator: '>=',
      toOperator: '<=',
      tags: [],
      matchesOnly: false,
      criticalPathOnly: false,
      adhocFilters: [],
    };

    mockSetSearch = jest.fn();
    mockWip = undefined;
    mockSetWip = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with provided values', () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      expect(controller).toBeDefined();
    });
  });

  describe('useState', () => {
    it('returns current state with no filters', () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const state = controller.useState();

      expect(state).toEqual({
        filters: [],
        readOnly: false,
        allowCustomValue: true,
        supportsMultiValueOperators: false,
        wip: undefined,
        inputPlaceholder: 'Filter by attribute or text',
      });
    });

    it('returns current state with existing filters', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'service.name', operator: '!=', value: 'test' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const state = controller.useState();

      expect(state.filters).toHaveLength(2);
      expect(state.filters[0]).toMatchObject({
        key: 'http.method',
        operator: '=',
        value: 'GET',
      });
      expect(state.filters[1]).toMatchObject({
        key: 'service.name',
        operator: '!=',
        value: 'test',
      });
    });

    it('includes wip filter in state', () => {
      mockWip = {
        key: 'http.status_code',
        operator: '=',
        value: '',
      };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const state = controller.useState();

      expect(state.wip).toEqual(mockWip);
    });
  });

  describe('getKeys', () => {
    it('returns available keys including special keys', async () => {
      mockGetTraceTagKeys.mockReturnValue(['http.method', 'http.status_code', 'service.name']);

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const keys = await controller.getKeys(null);

      expect(keys).toHaveLength(5); // Text search, duration, + 3 trace keys
      expect(keys[0]).toMatchObject({
        label: 'Text search',
        value: '_textSearch_',
      });
      expect(keys[1]).toMatchObject({
        label: 'duration',
        value: 'duration',
      });
      expect(keys[2]).toMatchObject({
        value: 'http.method',
      });
    });

    it('calls getTraceTagKeys with trace', async () => {
      mockGetTraceTagKeys.mockReturnValue(['key1', 'key2']);

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      await controller.getKeys(null);

      expect(mockGetTraceTagKeys).toHaveBeenCalledWith(mockTrace);
    });
  });

  describe('getValuesFor', () => {
    it('returns empty array when no key is provided', async () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const values = await controller.getValuesFor({ key: '', operator: '=', value: '' });

      expect(values).toEqual([]);
    });

    it('returns duration values for duration key', async () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const values = await controller.getValuesFor({ key: 'duration', operator: '=', value: '' });

      expect(values).toHaveLength(4);
      expect(values[0]).toMatchObject({ label: '1ms', value: '1ms' });
      expect(values[1]).toMatchObject({ label: '1s', value: '1s' });
      expect(values[2]).toMatchObject({ label: '1m', value: '1m' });
      expect(values[3]).toMatchObject({ label: '1h', value: '1h' });
    });

    it('returns placeholder for text search key', async () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const values = await controller.getValuesFor({ key: '_textSearch_', operator: '=~', value: '' });

      expect(values).toHaveLength(1);
      expect(values[0]).toMatchObject({
        label: 'Type a value',
        value: 'customValue',
        isDisabled: true,
      });
    });

    it('returns values from trace for regular keys', async () => {
      mockGetTraceTagValues.mockReturnValue(['GET', 'POST', 'PUT']);

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const values = await controller.getValuesFor({ key: 'http.method', operator: '=', value: '' });

      expect(mockGetTraceTagValues).toHaveBeenCalledWith(mockTrace, 'http.method');
      expect(values).toHaveLength(3);
      expect(values[0]).toMatchObject({ value: 'GET' });
      expect(values[1]).toMatchObject({ value: 'POST' });
      expect(values[2]).toMatchObject({ value: 'PUT' });
    });
  });

  describe('getOperators', () => {
    it('returns default operators', () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const operators = controller.getOperators();

      expect(operators).toHaveLength(4);
      expect(operators).toEqual([
        { label: '=', value: '=' },
        { label: '!=', value: '!=' },
        { label: '=~', value: '=~' },
        { label: '!~', value: '!~' },
      ]);
    });

    it('returns only =~ for text search', () => {
      mockWip = { key: '_textSearch_', operator: '=~', value: '' };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const operators = controller.getOperators();

      expect(operators).toHaveLength(1);
      expect(operators[0]).toEqual({ label: '=~', value: '=~' });
    });

    it('returns comparison operators for duration', () => {
      mockWip = { key: 'duration', operator: '>=', value: '' };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const operators = controller.getOperators();

      expect(operators).toHaveLength(5);
      expect(operators).toEqual([
        { label: '=', value: '=' },
        { label: '>=', value: '>=' },
        { label: '<=', value: '<=' },
        { label: '>', value: '>' },
        { label: '<', value: '<' },
      ]);
    });
  });

  describe('updateFilter', () => {
    it('updates wip filter without adding to filters', () => {
      mockWip = { key: 'http.method', operator: '=', value: '' };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.updateFilter(mockWip, { key: 'http.status_code' });

      expect(mockSetWip).toHaveBeenCalledWith({
        key: 'http.status_code',
        operator: '=',
        value: '',
      });
      expect(mockSetSearch).not.toHaveBeenCalled();
    });

    it('completes wip filter when value is set', () => {
      mockWip = { key: 'http.method', operator: '=', value: '' };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.updateFilter(mockWip, { value: 'GET' });

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [
          {
            key: 'http.method',
            operator: '=',
            value: 'GET',
          },
        ],
      });
      expect(mockSetWip).toHaveBeenCalledWith(undefined);
    });

    it('does not complete wip filter when value is empty string', () => {
      mockWip = { key: 'http.method', operator: '=', value: 'GET' };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.updateFilter(mockWip, { value: '' });

      expect(mockSetWip).toHaveBeenCalledWith({
        key: 'http.method',
        operator: '=',
        value: '',
      });
      expect(mockSetSearch).not.toHaveBeenCalled();
    });

    it('updates existing filter', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'http.status_code', operator: '=', value: '200' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filterToUpdate: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.updateFilter(filterToUpdate, { value: 'POST' });

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [
          { key: 'http.method', operator: '=', value: 'POST' },
          { key: 'http.status_code', operator: '=', value: '200' },
        ],
      });
    });

    it('updates operator of existing filter', () => {
      mockSearch.adhocFilters = [{ key: 'http.method', operator: '=', value: 'GET' }];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filterToUpdate: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.updateFilter(filterToUpdate, { operator: '!=' });

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [{ key: 'http.method', operator: '!=', value: 'GET' }],
      });
    });
  });

  describe('updateToMatchAll', () => {
    it('updates filter to match all pattern', () => {
      mockSearch.adhocFilters = [{ key: 'http.method', operator: '=', value: 'GET' }];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filterToUpdate: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.updateToMatchAll(filterToUpdate);

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [
          {
            key: 'http.method',
            operator: '=~',
            value: '.*',
            matchAllFilter: true,
          },
        ],
      });
    });
  });

  describe('removeFilter', () => {
    it('removes a filter from the list', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'http.status_code', operator: '=', value: '200' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filterToRemove: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.removeFilter(filterToRemove);

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [{ key: 'http.status_code', operator: '=', value: '200' }],
      });
    });

    it('handles removing from empty list', () => {
      mockSearch.adhocFilters = [];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filterToRemove: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.removeFilter(filterToRemove);

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [],
      });
    });

    it('removes only matching filter', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'http.method', operator: '!=', value: 'POST' },
        { key: 'http.status_code', operator: '=', value: '200' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filterToRemove: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.removeFilter(filterToRemove);

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [
          { key: 'http.method', operator: '!=', value: 'POST' },
          { key: 'http.status_code', operator: '=', value: '200' },
        ],
      });
    });
  });

  describe('removeLastFilter', () => {
    it('removes the last filter', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'http.status_code', operator: '=', value: '200' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.removeLastFilter();

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [{ key: 'http.method', operator: '=', value: 'GET' }],
      });
    });

    it('handles empty filter list', () => {
      mockSearch.adhocFilters = [];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.removeLastFilter();

      expect(mockSetSearch).not.toHaveBeenCalled();
    });

    it('removes the only filter', () => {
      mockSearch.adhocFilters = [{ key: 'http.method', operator: '=', value: 'GET' }];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.removeLastFilter();

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [],
      });
    });
  });

  describe('handleComboboxBackspace', () => {
    it('sets forceEdit on previous filter', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'http.status_code', operator: '=', value: '200' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const currentFilter: AdHocFilterWithLabels = {
        key: 'http.status_code',
        operator: '=',
        value: '200',
      };

      controller.handleComboboxBackspace(currentFilter);

      expect(mockSetSearch).toHaveBeenCalledWith({
        ...mockSearch,
        adhocFilters: [
          { key: 'http.method', operator: '=', value: 'GET', forceEdit: true },
          { key: 'http.status_code', operator: '=', value: '200', forceEdit: false },
        ],
      });
    });

    it('does nothing for first filter', () => {
      mockSearch.adhocFilters = [
        { key: 'http.method', operator: '=', value: 'GET' },
        { key: 'http.status_code', operator: '=', value: '200' },
      ];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const currentFilter: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      controller.handleComboboxBackspace(currentFilter);

      expect(mockSetSearch).not.toHaveBeenCalled();
    });

    it('handles filter not in list', () => {
      mockSearch.adhocFilters = [{ key: 'http.method', operator: '=', value: 'GET' }];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const nonExistentFilter: AdHocFilterWithLabels = {
        key: 'nonexistent',
        operator: '=',
        value: 'value',
      };

      controller.handleComboboxBackspace(nonExistentFilter);

      expect(mockSetSearch).not.toHaveBeenCalled();
    });
  });

  describe('addWip', () => {
    it('creates a new wip filter with default values', () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.addWip();

      expect(mockSetWip).toHaveBeenCalledWith({
        key: '',
        operator: '=',
        value: '',
      });
    });
  });

  describe('restoreOriginalFilter', () => {
    it('does nothing as trace filters do not support origin filters', () => {
      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const filter: AdHocFilterWithLabels = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
      };

      // Should not throw and should not call any setters
      expect(() => controller.restoreOriginalFilter(filter)).not.toThrow();
      expect(mockSetSearch).not.toHaveBeenCalled();
      expect(mockSetWip).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles undefined adhocFilters in search', () => {
      mockSearch.adhocFilters = undefined;

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const state = controller.useState();
      expect(state.filters).toEqual([]);

      controller.removeLastFilter();
      expect(mockSetSearch).not.toHaveBeenCalled();
    });

    it('handles filters with additional properties', () => {
      const filterWithExtraProps: SelectableValue<string> = {
        key: 'http.method',
        operator: '=',
        value: 'GET',
        label: 'HTTP Method',
        description: 'The HTTP method',
      };

      mockSearch.adhocFilters = [filterWithExtraProps];

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      const state = controller.useState();
      expect(state.filters[0]).toMatchObject({
        key: 'http.method',
        operator: '=',
        value: 'GET',
        label: 'HTTP Method',
        description: 'The HTTP method',
      });
    });

    it('handles updateFilter with multiple properties at once', () => {
      mockWip = { key: '', operator: '=', value: '' };

      const controller = new TraceAdHocFiltersController(mockTrace, mockSearch, mockSetSearch, mockWip, mockSetWip);

      controller.updateFilter(mockWip, {
        key: 'http.method',
        operator: '!=',
      });

      expect(mockSetWip).toHaveBeenCalledWith({
        key: 'http.method',
        operator: '!=',
        value: '',
      });
    });
  });
});
