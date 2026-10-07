import { renderHook } from '@testing-library/react';

import { createDataFrame, FieldType, type DataTransformerConfig } from '@grafana/data';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';

import { useColumnTransformations } from './useColumnTransformations';

it('reads visibility from the registered column transformations', () => {
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
  expect(result.current?.columnCatalog).toEqual(['A', 'B', 'C']);
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

  renderHook(() => useColumnTransformations(undefined, api, 'table', enabled));

  if (enabled) {
    expect(api.set).toHaveBeenCalledWith('table', [configs[1]]);
  } else {
    expect(api.set).not.toHaveBeenCalled();
  }
});
