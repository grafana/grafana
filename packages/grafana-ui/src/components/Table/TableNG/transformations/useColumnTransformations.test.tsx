import { act, renderHook } from '@testing-library/react';

import { createDataFrame, FieldType, type DataFrame, type DataTransformerConfig } from '@grafana/data';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';

import { useColumnTransformations } from './useColumnTransformations';

function sourceFrame(names: string[], refId = 'A', overrideHidden: string[] = []): DataFrame {
  return createDataFrame({
    refId,
    fields: names.map((name) => ({
      name,
      type: FieldType.number,
      values: [1],
      config: { custom: { hideFrom: { viz: overrideHidden.includes(name) } } },
    })),
  });
}

function renderColumnState(initialSource: DataFrame[], initialConfigs: DataTransformerConfig[]) {
  let configs: readonly DataTransformerConfig[] = initialConfigs;
  const listeners = new Set<() => void>();
  const api: PanelRuntimeTransformations = {
    get: () => configs,
    getSourceSeries: () => initialSource,
    set: jest.fn((_, next) => {
      configs = next;
      listeners.forEach((listener) => listener());
    }),
    subscribe: (_, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const view = renderHook(({ source, index }) => useColumnTransformations(index, api, 'table', true, source), {
    initialProps: { source: initialSource, index: 0 },
  });
  return { ...view, api, getConfigs: () => configs };
}

const orderedConfig: DataTransformerConfig = {
  id: 'organize',
  filter: { id: 'byRefId', options: 'A' },
  options: { indexByName: { C: 0, A: 1, B: 2 }, excludeByName: { B: true }, renameByName: {} },
};

it('keeps viewer order and hidden columns when upstream adds, removes, or override-hides columns in place', () => {
  const source = [sourceFrame(['A', 'B', 'C'])];
  const { result, rerender, api } = renderColumnState(source, [orderedConfig]);

  rerender({ source: [sourceFrame(['A', 'New', 'B', 'C'])], index: 0 });
  expect(result.current?.columnOrder).toEqual(['C', 'A', 'New', 'B']);
  expect(result.current?.hiddenColumns).toEqual(new Set(['B']));

  rerender({ source: [sourceFrame(['A', 'B', 'C'])], index: 0 });
  rerender({ source: [sourceFrame(['A', 'B', 'C'], 'A', ['A'])], index: 0 });
  expect(result.current?.columnOrder).toEqual(['C', 'B']);
  expect(result.current?.hiddenColumns).toEqual(new Set(['B']));

  rerender({ source: [sourceFrame(['A', 'B', 'C'])], index: 0 });
  expect(result.current?.columnOrder).toEqual(['C', 'A', 'B']);
  expect(api.set).not.toHaveBeenCalled();
});

it('does not reset viewer order when ad-hoc visibility changes its own output', () => {
  const source = [sourceFrame(['A', 'B', 'C'])];
  const { result, rerender, getConfigs } = renderColumnState(source, [orderedConfig]);

  // Unlike an upstream override, ad-hoc hiding keeps A in the source catalog and in its saved position.
  act(() => result.current?.onHiddenColumnsChange(new Set(['A'])));
  rerender({ source: [sourceFrame(['A', 'B', 'C'])], index: 0 });

  expect(result.current?.columnOrder).toEqual(['C', 'A', 'B']);
  expect(result.current?.hiddenColumns).toEqual(new Set(['A']));
  expect(getConfigs()[0].options?.indexByName).toEqual({ C: 0, A: 1, B: 2 });
});

it('clears viewer order but retains visibility and unrelated transforms when upstream reorders shared columns', () => {
  const source = [sourceFrame(['A', 'B', 'C'])];
  const unrelated: DataTransformerConfig = { id: 'limit', options: { limitField: 3 } };
  const { result, rerender, getConfigs } = renderColumnState(source, [orderedConfig, unrelated]);

  rerender({ source: [sourceFrame(['B', 'A', 'C'])], index: 0 });

  expect(result.current?.columnOrder).toBeUndefined();
  expect(result.current?.columnCatalog).toEqual(['B', 'A', 'C']);
  expect(result.current?.hiddenColumns).toEqual(new Set(['B']));
  expect(getConfigs()).toEqual([
    {
      ...orderedConfig,
      options: { indexByName: {}, excludeByName: { B: true }, renameByName: {} },
    },
    unrelated,
  ]);
});

it('keeps viewer order through a value-only refresh and clears stale order for a replacement schema', () => {
  const source = [sourceFrame(['A', 'B', 'C'])];
  const { result, rerender, api } = renderColumnState(source, [orderedConfig]);

  rerender({ source: [sourceFrame(['A', 'B', 'C'])], index: 0 });
  expect(result.current?.columnOrder).toEqual(['C', 'A', 'B']);
  expect(api.set).not.toHaveBeenCalled();

  rerender({ source: [sourceFrame(['X', 'Y', 'Z'])], index: 0 });
  expect(result.current?.columnOrder).toBeUndefined();
  expect(result.current?.columnCatalog).toEqual(['X', 'Y', 'Z']);
});

it('preserves viewer order through an empty catalog, then still detects a replacement schema', () => {
  const source = [sourceFrame(['A', 'B', 'C'])];
  const { result, rerender, getConfigs } = renderColumnState(source, [orderedConfig]);

  rerender({ source: [sourceFrame([])], index: 0 });
  expect(getConfigs()[0].options?.indexByName).toEqual({ C: 0, A: 1, B: 2 });

  rerender({ source: [sourceFrame(['A', 'B', 'C'])], index: 0 });
  expect(result.current?.columnOrder).toEqual(['C', 'A', 'B']);

  rerender({ source: [sourceFrame([])], index: 0 });
  rerender({ source: [sourceFrame(['X', 'Y', 'Z'])], index: 0 });
  expect(result.current?.columnOrder).toBeUndefined();
});

it('clears only the changed frame order after switching between frames', () => {
  const source = [sourceFrame(['A', 'B', 'C']), sourceFrame(['X', 'Y'], 'B')];
  const otherOrder: DataTransformerConfig = {
    id: 'organize',
    filter: { id: 'byRefId', options: 'B' },
    options: { indexByName: { Y: 0, X: 1 } },
  };
  const { result, rerender, getConfigs } = renderColumnState(source, [orderedConfig, otherOrder]);

  rerender({ source, index: 1 });
  expect(result.current?.columnOrder).toEqual(['Y', 'X']);
  rerender({ source: [sourceFrame(['B', 'A', 'C']), source[1]], index: 0 });

  expect(result.current?.columnOrder).toBeUndefined();
  expect(getConfigs()[1]).toEqual(otherOrder);
});

it('reads visibility and order from the registered column transformations', () => {
  const source = [
    createDataFrame({
      fields: ['A', 'B', 'C'].map((name) => ({ name, type: FieldType.number, values: [1] })),
    }),
  ];
  const configs: DataTransformerConfig[] = [
    {
      id: 'organize',
      options: {
        excludeByName: { B: true },
        indexByName: { C: 0, A: 1, B: 2 },
      },
    },
  ];
  const api: PanelRuntimeTransformations = {
    get: () => configs,
    getSourceSeries: () => source,
    set: jest.fn(),
    subscribe: () => () => {},
  };

  const { result } = renderHook(() => useColumnTransformations(0, api, 'table'));

  expect(result.current?.hiddenColumns).toEqual(new Set(['B']));
  expect(result.current?.columnOrder).toEqual(['C', 'A', 'B']);
  expect(result.current?.columnCatalog).toEqual(['C', 'A', 'B']);
  expect(api.set).not.toHaveBeenCalled();
});

it('reveals one remaining source column when a refresh leaves the entire frame hidden', () => {
  const source = [
    createDataFrame({
      fields: ['B', 'C'].map((name) => ({ name, type: FieldType.number, values: [1] })),
    }),
  ];
  const configs: DataTransformerConfig[] = [
    { id: 'organize', options: { excludeByName: { B: true, C: true, Missing: true } } },
  ];
  const api: PanelRuntimeTransformations = {
    get: () => configs,
    getSourceSeries: () => source,
    set: jest.fn(),
    subscribe: () => () => {},
  };

  renderHook(() => useColumnTransformations(0, api, 'table'));

  expect(api.set).toHaveBeenCalledWith('table', [
    {
      id: 'organize',
      options: { indexByName: {}, excludeByName: { C: true, Missing: true }, renameByName: {} },
    },
  ]);
});

it.each([false, true])('recovers a missing output frame only when enabled=%s', (enabled) => {
  const source = [
    createDataFrame({
      refId: 'A',
      fields: [{ name: 'Hidden', type: FieldType.number, values: [1] }],
    }),
    createDataFrame({
      refId: 'B',
      fields: [{ name: 'Visible', type: FieldType.number, values: [2] }],
    }),
  ];
  const configs: DataTransformerConfig[] = [
    {
      id: 'organize',
      filter: { id: 'byRefId', options: 'A' },
      options: { excludeByName: { Hidden: true } },
    },
    { id: 'limit', options: { limitField: 3 } },
  ];
  const api: PanelRuntimeTransformations = {
    get: () => configs,
    getSourceSeries: () => source,
    set: jest.fn(),
    subscribe: () => () => {},
  };

  renderHook(() => useColumnTransformations(-1, api, 'table', enabled));

  if (enabled) {
    expect(api.set).toHaveBeenCalledWith('table', [configs[1]]);
  } else {
    expect(api.set).not.toHaveBeenCalled();
  }
});
