import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { TraceSearchProps } from '@grafana/data';

import { DEFAULT_SPAN_FILTERS, randomId } from '../state/constants';

import { TraceSpan } from './components/types/trace';
import { useSearch } from './useSearch';

// Create a mock store with the necessary structure
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      explore: (state = { panes: {} }) => state,
    },
    preloadedState: {
      explore: {
        panes: {},
        ...initialState,
      },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: true,
        serializableCheck: false,
        immutableCheck: false,
      }),
  });
};

// Create a wrapper component that provides the Redux store
const createWrapper = (store: ReturnType<typeof createMockStore>) => {
  return ({ children }: { children: ReactNode }) => {
    return React.createElement(Provider, { store, children });
  };
};

describe('useSearch', () => {
  const spans = [
    {
      spanID: 'span1',
      operationName: 'operation1',
      process: {
        serviceName: 'service1',
        tags: [],
      },
      tags: [],
      logs: [],
    } as unknown as TraceSpan,
    {
      spanID: 'span2',
      operationName: 'operation2',
      process: {
        serviceName: 'service2',
        tags: [],
      },
      tags: [],
      logs: [],
    } as unknown as TraceSpan,
  ];

  it('returns matching span IDs', async () => {
    const store = createMockStore();
    const wrapper = createWrapper(store);

    // Use local state by not providing exploreId
    const { result } = renderHook(() => useSearch(undefined, spans), { wrapper });
    act(() => result.current.setSearch({ ...DEFAULT_SPAN_FILTERS, serviceName: 'service1' }));
    expect(result.current.spanFilterMatches?.size).toBe(1);
    expect(result.current.spanFilterMatches?.has('span1')).toBe(true);
  });

  it('works without spans', async () => {
    const store = createMockStore();
    const wrapper = createWrapper(store);

    // Use local state by not providing exploreId
    const { result } = renderHook(() => useSearch(), { wrapper });
    act(() => result.current.setSearch({ ...DEFAULT_SPAN_FILTERS, serviceName: 'service1' }));
    expect(result.current.spanFilterMatches).toBe(undefined);
  });

  describe('migration to adhoc filters', () => {
    it('migrates serviceName to adhoc filter', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        serviceName: 'my-service',
        serviceNameOperator: '=',
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that adhoc filter was created
      expect(result.current.search.adhocFilters).toHaveLength(1);
      expect(result.current.search.adhocFilters?.[0]).toMatchObject({
        key: 'serviceName',
        operator: '=',
        value: 'my-service',
      });
    });

    it('migrates spanName to adhoc filter', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        spanName: 'my-operation',
        spanNameOperator: '!=',
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that adhoc filter was created
      expect(result.current.search.adhocFilters).toHaveLength(1);
      expect(result.current.search.adhocFilters?.[0]).toMatchObject({
        key: 'spanName',
        operator: '!=',
        value: 'my-operation',
      });
    });

    it('migrates query to _textSearch_ adhoc filter', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        query: 'error timeout',
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that adhoc filter was created
      expect(result.current.search.adhocFilters).toHaveLength(1);
      expect(result.current.search.adhocFilters?.[0]).toMatchObject({
        key: '_textSearch_',
        operator: '=',
        value: 'error timeout',
      });
    });

    it('migrates tags to adhoc filters', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        tags: [
          { id: randomId(), key: 'http.status_code', operator: '=', value: '500' },
          { id: randomId(), key: 'error', operator: '=~', value: 'timeout' },
        ],
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that adhoc filters were created
      expect(result.current.search.adhocFilters).toHaveLength(2);
      expect(result.current.search.adhocFilters?.[0]).toMatchObject({
        key: 'http.status_code',
        operator: '=',
        value: '500',
      });
      expect(result.current.search.adhocFilters?.[1]).toMatchObject({
        key: 'error',
        operator: '=~',
        value: 'timeout',
      });
    });

    it('migrates multiple filter types together', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        serviceName: 'my-service',
        serviceNameOperator: '=',
        spanName: 'my-operation',
        spanNameOperator: '!=',
        query: 'error',
        tags: [{ id: randomId(), key: 'http.status_code', operator: '=', value: '500' }],
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that all filters were migrated (serviceName, spanName, query, 1 tag = 4 total)
      expect(result.current.search.adhocFilters).toHaveLength(4);

      // Verify each filter
      const filters = result.current.search.adhocFilters || [];
      expect(filters.find((f) => f.key === 'serviceName')).toMatchObject({
        key: 'serviceName',
        operator: '=',
        value: 'my-service',
      });
      expect(filters.find((f) => f.key === 'spanName')).toMatchObject({
        key: 'spanName',
        operator: '!=',
        value: 'my-operation',
      });
      expect(filters.find((f) => f.key === '_textSearch_')).toMatchObject({
        key: '_textSearch_',
        operator: '=',
        value: 'error',
      });
      expect(filters.find((f) => f.key === 'http.status_code')).toMatchObject({
        key: 'http.status_code',
        operator: '=',
        value: '500',
      });
    });

    it('does not migrate if adhoc filters already exist', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        serviceName: 'my-service',
        serviceNameOperator: '=',
        adhocFilters: [
          {
            key: 'existing-key',
            operator: '=',
            value: 'existing-value',
          },
        ],
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that only existing adhoc filter remains (no migration happened)
      expect(result.current.search.adhocFilters).toHaveLength(1);
      expect(result.current.search.adhocFilters?.[0]).toMatchObject({
        key: 'existing-key',
        operator: '=',
        value: 'existing-value',
      });
    });

    it('skips empty or whitespace-only filters during migration', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        serviceName: '   ', // whitespace only
        spanName: '', // empty
        query: '  ', // whitespace only
        tags: [
          { id: randomId(), key: '', operator: '=', value: 'some-value' }, // empty key
          { id: randomId(), key: 'some-key', operator: '=', value: '' }, // empty value
          { id: randomId(), key: '  ', operator: '=', value: '  ' }, // whitespace only
        ],
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that no adhoc filters were created
      expect(result.current.search.adhocFilters).toHaveLength(0);
    });

    it('applies adhoc filters to span matching', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        serviceName: 'service1',
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // The serviceName filter should be migrated to adhoc filter and applied
      expect(result.current.spanFilterMatches?.size).toBe(1);
      expect(result.current.spanFilterMatches?.has('span1')).toBe(true);
      expect(result.current.spanFilterMatches?.has('span2')).toBe(false);
    });

    it('handles different operators during migration', () => {
      const store = createMockStore();
      const wrapper = createWrapper(store);

      const initialFilters: TraceSearchProps = {
        ...DEFAULT_SPAN_FILTERS,
        serviceName: 'my-service',
        serviceNameOperator: '!=',
        tags: [
          { id: randomId(), key: 'tag1', operator: '=', value: 'value1' },
          { id: randomId(), key: 'tag2', operator: '!=', value: 'value2' },
          { id: randomId(), key: 'tag3', operator: '=~', value: 'pattern' },
          { id: randomId(), key: 'tag4', operator: '!~', value: 'pattern' },
        ],
      };

      const { result } = renderHook(() => useSearch(undefined, spans, initialFilters), { wrapper });

      // Check that operators were preserved
      expect(result.current.search.adhocFilters).toHaveLength(5);

      const filters = result.current.search.adhocFilters || [];
      expect(filters.find((f) => f.key === 'serviceName')?.operator).toBe('!=');
      expect(filters.find((f) => f.key === 'tag1')?.operator).toBe('=');
      expect(filters.find((f) => f.key === 'tag2')?.operator).toBe('!=');
      expect(filters.find((f) => f.key === 'tag3')?.operator).toBe('=~');
      expect(filters.find((f) => f.key === 'tag4')?.operator).toBe('!~');
    });
  });
});
