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
});
