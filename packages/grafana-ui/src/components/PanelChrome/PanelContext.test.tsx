import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { type DataTransformerConfig, EventBusSrv, toDataFrame } from '@grafana/data';
import { VizPanel, type VizPanelRuntimeTransformations } from '@grafana/scenes';

import { type PanelContext, PanelContextProvider, useAdHocTransformations } from './PanelContext';

function createRuntimeTransformations() {
  let transformations: readonly DataTransformerConfig[] = [];
  const listeners = new Set<() => void>();
  const sourceSeries = [toDataFrame({ fields: [{ name: 'value', values: [1] }] })];

  const api: VizPanelRuntimeTransformations = {
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

  it('reads and updates only the selected owner when sharing the Scenes controller', () => {
    const api = new VizPanel({ pluginId: 'table' }).getRuntimeTransformations();
    api.set('table', [{ id: 'organize', options: {} }]);
    api.set('other', [{ id: 'limit', options: { limitField: 2 } }]);
    const { result, rerender } = renderHook(({ owner }) => useAdHocTransformations(owner), {
      initialProps: { owner: 'table' },
      wrapper: wrapperWith({ eventsScope: 'global', eventBus: new EventBusSrv(), adHocTransformations: api }),
    });

    expect(result.current?.transformations).toEqual([{ id: 'organize', options: {} }]);
    act(() => result.current?.setTransformations([]));
    expect(api.get('table')).toEqual([]);
    expect(api.get('other')).toEqual([{ id: 'limit', options: { limitField: 2 } }]);

    rerender({ owner: 'other' });
    act(() => api.set('table', [{ id: 'organize', options: {} }]));
    expect(result.current?.transformations).toEqual([{ id: 'limit', options: { limitField: 2 } }]);
    act(() => api.set('other', [{ id: 'limit', options: { limitField: 3 } }]));
    expect(result.current?.transformations).toEqual([{ id: 'limit', options: { limitField: 3 } }]);
  });
});
