import { render, screen } from '@testing-library/react';
import React from 'react';

import {
  DataTransformerConfig,
  FieldType,
  LoadingState,
  PanelData,
  TimeRange,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { calculateFieldTransformRegistryItem } from 'app/features/transformers/editors/CalculateFieldTransformerEditor';

import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';

function createModelMock(panelData: PanelData, transformations: DataTransformerConfig[]) {
  return {
    getDataTransformer: () => new SceneDataTransformer({ data: panelData, transformations }),
    getQueryRunner: () => new SceneQueryRunner({ queries: [], data: panelData }),
  } as unknown as PanelDataTransformationsTab;
}

describe('PanelDataTransformationsTab', () => {
  it('renders empty message when there are no transformations', async () => {
    const modelMock = createModelMock({} as PanelData, []);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    await screen.findByTestId(selectors.components.Transforms.noTransformationsMessage);
  });

  it('renders transformations when there are transformations', async () => {
    standardTransformersRegistry.register(calculateFieldTransformRegistryItem);
    const modelMock = createModelMock(
      {
        timeRange: {} as unknown as TimeRange,
        state: {} as unknown as LoadingState,
        series: [
          toDataFrame({
            name: 'A',
            fields: [
              { name: 'time', type: FieldType.time, values: [100, 200, 300] },
              { name: 'values', type: FieldType.number, values: [1, 2, 3] },
            ],
          }),
        ],
      },
      [
        {
          id: 'calculateField',
          options: {},
        },
      ]
    );
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    await screen.findByText('1 - Add field from calculation');
  });
});
