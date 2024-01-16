import { render, screen } from '@testing-library/react';
import React from 'react';

import { FieldType, LoadingState, TimeRange, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneDataTransformer } from '@grafana/scenes';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';

function createPanelManagerMock(sceneDataTransformer: SceneDataTransformer) {
  return {
    getDataTransformer: () => sceneDataTransformer,
  } as unknown as PanelDataTransformationsTab;
}

describe('PanelDataTransformationsTab', () => {
  it('renders empty message when there are no transformations', async () => {
    const modelMock = createPanelManagerMock(new SceneDataTransformer({ transformations: [] }));
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    await screen.findByTestId(selectors.components.Transforms.noTransformationsMessage);
  });

  it('renders transformations when there are transformations', async () => {
    standardTransformersRegistry.setInit(getStandardTransformers);
    const modelMock = createPanelManagerMock(
      new SceneDataTransformer({
        data: {
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
        transformations: [
          {
            id: 'calculateField',
            options: {},
          },
        ],
      })
    );
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    await screen.findByText('1 - Add field from calculation');
  });
});
