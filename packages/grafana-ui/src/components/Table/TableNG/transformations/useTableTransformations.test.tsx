import { act, renderHook } from '@testing-library/react';

import { type DataTransformerConfig } from '@grafana/data';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';

import { columnTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

it('composes successive actions against the latest host state and preserves other frames', () => {
  let configs: readonly DataTransformerConfig[] = [];
  const api: PanelRuntimeTransformations = {
    get: () => configs,
    set: (_owner, next) => {
      configs = next;
    },
    getSourceSeries: () => [],
    subscribe: () => () => {},
  };
  const { result } = renderHook(() => useTableTransformations(api, 'table'));
  const frameA = { catalog: ['A', 'B'], frameFilter: { id: 'byRefId', options: 'A' } };
  const frameB = { catalog: ['C', 'D'], frameFilter: { id: 'byRefId', options: 'B' } };

  act(() => {
    result.current.update((current) => columnTransformations.columnVisibility.write(current, new Set(['B']), frameA));
    result.current.update((current) => columnTransformations.columnVisibility.write(current, new Set(['D']), frameB));
    result.current.update((current) => columnTransformations.columnVisibility.write(current, new Set(), frameA));
  });

  expect(configs).toEqual([
    {
      id: 'organize',
      filter: { id: 'byRefId', options: 'B' },
      options: { indexByName: {}, excludeByName: { D: true }, renameByName: {} },
    },
  ]);
});

it('does not create local column transformations without a host', () => {
  const { result } = renderHook(() => useTableTransformations(undefined, 'table'));
  act(() => result.current.update(() => [{ id: 'organize', options: { excludeByName: { A: true } } }]));
  expect(result.current.transformations).toEqual([]);
});
