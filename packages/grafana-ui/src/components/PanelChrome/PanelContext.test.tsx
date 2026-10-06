import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { type DataTransformerConfig, EventBusSrv, toDataFrame } from '@grafana/data';

import {
  type PanelContext,
  PanelContextProvider,
  type PanelRuntimeTransformations,
  useAdHocTransformations,
} from './PanelContext';

function createRuntimeTransformations() {
  let transformations: readonly DataTransformerConfig[] = [];
  const listeners = new Set<() => void>();
  const sourceSeries = [toDataFrame({ fields: [{ name: 'value', values: [1] }] })];

  const api: PanelRuntimeTransformations = {
    get: () => transformations,
    set: (_owner, nextTransformations) => {
      transformations = nextTransformations;
      listeners.forEach((listener) => listener());
    },
    getSourceSeries: () => sourceSeries,
    subscribe: (_owner, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return { api, sourceSeries };
}

function wrapperWith(context: PanelContext) {
  return ({ children }: PropsWithChildren) => <PanelContextProvider value={context}>{children}</PanelContextProvider>;
}

describe('useAdHocTransformations', () => {
  it('returns undefined when the panel host does not provide an ad-hoc stage', () => {
    const { result } = renderHook(() => useAdHocTransformations('table'), {
      wrapper: wrapperWith({ eventsScope: 'global', eventBus: new EventBusSrv() }),
    });

    expect(result.current).toBeUndefined();
  });

  it('exposes reactive transformations without requiring consumers to subscribe to the API', () => {
    const { api, sourceSeries } = createRuntimeTransformations();
    const { result } = renderHook(() => useAdHocTransformations('table'), {
      wrapper: wrapperWith({ eventsScope: 'global', eventBus: new EventBusSrv(), adHocTransformations: api }),
    });
    const nextTransformations: DataTransformerConfig[] = [{ id: 'organize', options: {} }];

    expect(result.current).toEqual({ transformations: [], sourceSeries, setTransformations: expect.any(Function) });

    act(() => result.current?.setTransformations(nextTransformations));

    expect(result.current?.transformations).toBe(nextTransformations);
  });
});
