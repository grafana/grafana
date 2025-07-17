import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { DEFAULT_SPAN_FILTERS } from '../state/constants';

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
});
