import { act, renderHook } from '@testing-library/react';

import {
  cacheFieldDisplayNames,
  createDataFrame,
  FieldType,
  type DataFrame,
  type DataTransformerConfig,
} from '@grafana/data';

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

function asTableShows(frames: DataFrame[]): DataFrame[] {
  const shown = frames.map((frame) => ({
    ...frame,
    fields: frame.fields.map((field) => ({ ...field, state: undefined })),
  }));
  cacheFieldDisplayNames(shown);
  return shown;
}

function renderColumnState(
  initialSource: DataFrame[],
  initialConfigs: DataTransformerConfig[],
  onInteraction?: (action: 'visibility' | 'reorder') => void,
  initialDisplay?: DataFrame[]
) {
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
  const initialProps: { source: DataFrame[]; index: number; display?: DataFrame[] } = {
    source: initialSource,
    index: 0,
    display: initialDisplay,
  };
  const view = renderHook(
    ({ source, index, display }) => useColumnTransformations(index, api, 'table', true, source, onInteraction, display),
    { initialProps }
  );
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
      options: { indexByName: {}, excludeByName: { B: true }, renameByName: {}, referenceByName: { B: { name: 'B' } } },
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

it('keeps viewer order when the table is handed a different panel and then its own panel back', () => {
  const source = [sourceFrame(['A', 'B', 'C'])];
  const originalConfigs = [orderedConfig];
  const original: PanelRuntimeTransformations = {
    get: () => originalConfigs,
    getSourceSeries: () => source,
    set: jest.fn(),
    subscribe: () => () => {},
  };
  // A panel with the viewer changes saved into it, so its source already has them applied.
  const promotedSource = [sourceFrame(['C', 'A'])];
  const promotedConfigs: DataTransformerConfig[] = [];
  const promoted: PanelRuntimeTransformations = {
    get: () => promotedConfigs,
    getSourceSeries: () => promotedSource,
    set: jest.fn(),
    subscribe: () => () => {},
  };
  const { result, rerender } = renderHook(
    ({ api, source }) => useColumnTransformations(0, api, 'table', true, source),
    { initialProps: { api: original, source } }
  );

  rerender({ api: promoted, source: promotedSource });
  rerender({ api: original, source });

  expect(result.current?.columnOrder).toEqual(['C', 'A', 'B']);
  expect(result.current?.hiddenColumns).toEqual(new Set(['B']));
  expect(original.set).not.toHaveBeenCalled();
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
      options: {
        indexByName: {},
        excludeByName: { C: true, Missing: true },
        renameByName: {},
        referenceByName: { C: { name: 'C' } },
      },
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

it('keeps hidden columns and viewer order when another named query appears', () => {
  const alpha = { ...sourceFrame(['customer_id', 'region_name', 'request_count']), name: 'Alpha' };
  const beta = { ...sourceFrame(['host_name'], 'B'), name: 'Beta' };
  const { result, rerender, api } = renderColumnState(
    [alpha],
    [
      {
        id: 'organize',
        filter: { id: 'byRefId', options: 'A' },
        options: {
          indexByName: { request_count: 0, customer_id: 1, region_name: 2 },
          excludeByName: { region_name: true },
        },
      },
    ],
    undefined,
    asTableShows([alpha])
  );
  expect(result.current?.columnOrder).toEqual(['request_count', 'customer_id', 'region_name']);

  rerender({ source: [alpha, beta], index: 0, display: asTableShows([alpha, beta]) });

  expect(result.current?.columnOrder).toEqual(['Alpha request_count', 'Alpha customer_id', 'Alpha region_name']);
  expect(result.current?.hiddenColumns).toEqual(new Set(['Alpha region_name']));
  expect(api.set).not.toHaveBeenCalled();
});

it('reports accepted column changes but not hydration or repeated actions', () => {
  const onInteraction = jest.fn();
  const { result, api } = renderColumnState([sourceFrame(['A', 'B', 'C'])], [], onInteraction);
  expect(result.current?.columnCatalog).toEqual(['A', 'B', 'C']);
  expect(onInteraction).not.toHaveBeenCalled();
  act(() => result.current?.onHiddenColumnsChange(new Set(['B'])));
  act(() => result.current?.onHiddenColumnsChange(new Set(['B'])));
  act(() => result.current?.onHiddenColumnsChange(new Set()));
  act(() => result.current?.onColumnOrderChange(['C', 'A', 'B']));
  act(() => result.current?.onColumnOrderChange(['C', 'A', 'B']));
  expect(onInteraction.mock.calls).toEqual([['visibility'], ['visibility'], ['reorder']]);
  expect(api.set).toHaveBeenCalledTimes(3);
});

describe('with display name overrides', () => {
  const source = [sourceFrame(['customer_id', 'region_name', 'request_count'])];
  const shownAs = (displayNames: string[]): DataFrame[] =>
    asTableShows([
      {
        ...source[0],
        fields: source[0].fields.map((field, index) => ({
          ...field,
          config: { ...field.config, displayName: displayNames[index] },
        })),
      },
    ]);
  const renamed = shownAs(['Customer', 'Region', 'Requests']);

  it('gives the table display names and stores source names', () => {
    const { result, getConfigs } = renderColumnState(source, [], undefined, renamed);
    expect(result.current?.columnCatalog).toEqual(['Customer', 'Region', 'Requests']);

    act(() => result.current?.onHiddenColumnsChange(new Set(['Region'])));
    act(() => result.current?.onColumnOrderChange(['Requests', 'Customer', 'Region']));

    expect(getConfigs()).toEqual([
      {
        id: 'organize',
        filter: { id: 'byRefId', options: 'A' },
        options: {
          indexByName: { request_count: 0, customer_id: 1, region_name: 2 },
          excludeByName: { region_name: true },
          renameByName: {},
          referenceByName: {
            region_name: { name: 'region_name' },
            request_count: { name: 'request_count' },
            customer_id: { name: 'customer_id' },
          },
        },
      },
    ]);
    expect(result.current?.hiddenColumns).toEqual(new Set(['Region']));
    expect(result.current?.columnOrder).toEqual(['Requests', 'Customer', 'Region']);
  });

  it('keeps viewer order when every display name changes', () => {
    const ordered: DataTransformerConfig = {
      id: 'organize',
      filter: { id: 'byRefId', options: 'A' },
      options: { indexByName: { request_count: 0, customer_id: 1, region_name: 2 } },
    };
    const { result, rerender, api } = renderColumnState(source, [ordered], undefined, renamed);
    expect(result.current?.columnOrder).toEqual(['Requests', 'Customer', 'Region']);

    rerender({ source, index: 0, display: shownAs(['Client', 'Area', 'Hits']) });

    expect(result.current?.columnOrder).toEqual(['Hits', 'Client', 'Area']);
    expect(api.set).not.toHaveBeenCalled();
  });

  it('does not record a reorder that keeps the source order', () => {
    const onInteraction = jest.fn();
    const { result, api } = renderColumnState(source, [], onInteraction, renamed);

    act(() => result.current?.onColumnOrderChange(['Customer', 'Region', 'Requests']));

    expect(result.current?.columnCatalog).toEqual(['Customer', 'Region', 'Requests']);
    expect(api.set).not.toHaveBeenCalled();
    expect(onInteraction).not.toHaveBeenCalled();
  });
});

describe('when an upstream transformation renames columns', () => {
  const names = ['time', 'host', 'value', 'region'];
  const renamedUpstream = (displayNames: Record<string, string>, fieldNames = names): DataFrame[] => {
    const frame = sourceFrame(fieldNames);
    return [
      {
        ...frame,
        fields: frame.fields.map((field) =>
          displayNames[field.name]
            ? { ...field, config: { ...field.config, displayName: displayNames[field.name] } }
            : field
        ),
      },
    ];
  };

  function renderWithViewChanges() {
    const view = renderColumnState([sourceFrame(names)], []);
    act(() => view.result.current?.onHiddenColumnsChange(new Set(['host'])));
    act(() => view.result.current?.onColumnOrderChange(['region', 'time', 'host', 'value']));
    jest.mocked(view.api.set).mockClear();
    return view;
  }

  it('keeps the renamed column hidden and in place', () => {
    const { result, rerender, api } = renderWithViewChanges();

    rerender({ source: renamedUpstream({ host: 'Host name' }), index: 0 });

    expect(result.current?.hiddenColumns).toEqual(new Set(['Host name']));
    expect(result.current?.columnOrder).toEqual(['region', 'time', 'Host name', 'value']);
    expect(api.set).not.toHaveBeenCalled();
  });

  it('does not move the changes to a column that takes the old name', () => {
    const { result, rerender, api } = renderWithViewChanges();

    rerender({ source: renamedUpstream({ host: 'region', region: 'host' }), index: 0 });

    expect(result.current?.hiddenColumns).toEqual(new Set(['region']));
    expect(result.current?.columnOrder).toEqual(['host', 'time', 'region', 'value']);
    expect(api.set).not.toHaveBeenCalled();
  });

  it('keeps the order when every column is renamed', () => {
    const { result, rerender, api } = renderWithViewChanges();

    rerender({ source: renamedUpstream({ time: 'T', host: 'H', value: 'V', region: 'R' }), index: 0 });

    expect(result.current?.hiddenColumns).toEqual(new Set(['H']));
    expect(result.current?.columnOrder).toEqual(['R', 'T', 'H', 'V']);
    expect(api.set).not.toHaveBeenCalled();
  });

  it('writes later changes against the current names', () => {
    const { result, rerender, getConfigs } = renderWithViewChanges();

    rerender({ source: renamedUpstream({ host: 'Host name' }), index: 0 });
    act(() => result.current?.onHiddenColumnsChange(new Set(['Host name', 'value'])));

    expect(getConfigs()).toEqual([
      {
        id: 'organize',
        filter: { id: 'byRefId', options: 'A' },
        options: {
          indexByName: { region: 0, time: 1, 'Host name': 2, value: 3 },
          excludeByName: { 'Host name': true, value: true },
          renameByName: {},
          referenceByName: {
            'Host name': { name: 'host' },
            value: { name: 'value' },
            region: { name: 'region' },
            time: { name: 'time' },
          },
        },
      },
    ]);
  });

  it('keeps a missing column hidden after another column takes its name', () => {
    const { result, rerender } = renderWithViewChanges();

    rerender({ source: renamedUpstream({ region: 'host' }, ['time', 'value', 'region']), index: 0 });
    expect(result.current?.hiddenColumns).toEqual(new Set());

    act(() => result.current?.onHiddenColumnsChange(new Set(['value'])));
    rerender({ source: [sourceFrame(names)], index: 0 });

    expect(result.current?.hiddenColumns).toEqual(new Set(['host', 'value']));
    expect(result.current?.columnOrder).toEqual(['region', 'time', 'host', 'value']);
  });
});
