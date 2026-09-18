import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { type DataTransformerConfig, EventBusSrv, toDataFrame } from '@grafana/data';

import {
  type AdHocTransformationsApi,
  type PanelContext,
  PanelContextProvider,
  useAdHocTransformations,
} from './PanelContext';

function createAdHocTransformationsApi() {
  const emptyTransformations: readonly DataTransformerConfig[] = [];
  const transformations = new Map<string, readonly DataTransformerConfig[]>();
  const listeners = new Map<string, Set<() => void>>();
  const sourceSeries = [toDataFrame({ fields: [{ name: 'value', values: [1] }] })];

  const api: AdHocTransformationsApi = {
    get: (tag) => transformations.get(tag) ?? emptyTransformations,
    set: (tag, nextTransformations) => {
      transformations.set(tag, nextTransformations);
      listeners.get(tag)?.forEach((listener) => listener());
    },
    getSourceSeries: () => sourceSeries,
    subscribe: (tag, listener) => {
      const tagListeners = listeners.get(tag) ?? new Set();
      tagListeners.add(listener);
      listeners.set(tag, tagListeners);
      return () => tagListeners.delete(listener);
    },
  };

  return { api, sourceSeries };
}

function wrapperWith(context: PanelContext) {
  return ({ children }: PropsWithChildren) => <PanelContextProvider value={context}>{children}</PanelContextProvider>;
}

describe('useAdHocTransformations', () => {
  const tag = 'test:owner';

  it('returns undefined when the panel host does not provide an ad-hoc stage', () => {
    const { result } = renderHook(() => useAdHocTransformations(tag), {
      wrapper: wrapperWith({ eventsScope: 'global', eventBus: new EventBusSrv() }),
    });

    expect(result.current).toBeUndefined();
  });

  it('exposes reactive transformations without requiring consumers to subscribe to the API', () => {
    const { api, sourceSeries } = createAdHocTransformationsApi();
    const { result } = renderHook(() => useAdHocTransformations(tag), {
      wrapper: wrapperWith({ eventsScope: 'global', eventBus: new EventBusSrv(), adHocTransformations: api }),
    });
    const nextTransformations: DataTransformerConfig[] = [{ id: 'organize', options: {} }];

    expect(result.current).toEqual({ transformations: [], sourceSeries, setTransformations: expect.any(Function) });

    act(() => result.current?.setTransformations(nextTransformations));

    expect(result.current?.transformations).toBe(nextTransformations);
  });
});
