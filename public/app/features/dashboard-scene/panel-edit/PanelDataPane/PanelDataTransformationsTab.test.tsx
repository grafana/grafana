import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../../utils/utils';
import { testDashboard } from '../testfiles/testDashboard';

import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';

function createModelMock(
  panelData: PanelData,
  transformations?: DataTransformerConfig[],
  onChangeTransformationsMock?: Function
) {
  return {
    getDataTransformer: () => new SceneDataTransformer({ data: panelData, transformations: transformations || [] }),
    getQueryRunner: () => new SceneQueryRunner({ queries: [], data: panelData }),
    onChangeTransformations: onChangeTransformationsMock,
  } as unknown as PanelDataTransformationsTab;
}

const mockData = {
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
};

describe('PanelDataTransformationsModel', () => {
  it('can change transformations', () => {
    const { transformsTab } = setupTabScene('panel-1');
    transformsTab.onChangeTransformations([{ id: 'calculateField', options: {} }]);
    expect(transformsTab.getDataTransformer().state.transformations).toEqual([{ id: 'calculateField', options: {} }]);
  });
});

describe('PanelDataTransformationsTab', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  it('renders empty message when there are no transformations', async () => {
    const modelMock = createModelMock({} as PanelData);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    await screen.findByTestId(selectors.components.Transforms.noTransformationsMessage);
  });

  it('renders transformations when there are transformations', async () => {
    const modelMock = createModelMock(mockData, [
      {
        id: 'calculateField',
        options: {},
      },
    ]);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    await screen.findByText('1 - Add field from calculation');
  });

  it('shows show the transformation selection drawer', async () => {
    const modelMock = createModelMock(mockData);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);
    const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
    await userEvent.click(addButton);
    await screen.findByTestId(selectors.components.Transforms.searchInput);
  });

  it('adds a transformation when a transformation is clicked in the drawer and there are no previous transformations', async () => {
    const onChangeTransformation = jest.fn();
    const modelMock = createModelMock(mockData, [], onChangeTransformation);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);
    const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
    await userEvent.click(addButton);
    const transformationCard = await screen.findByTestId(
      selectors.components.TransformTab.newTransform('Add field from calculation')
    );
    const button = transformationCard.getElementsByTagName('button').item(0);
    await userEvent.click(button!);

    expect(onChangeTransformation).toHaveBeenCalledWith([{ id: 'calculateField', options: {} }]);
  });

  it('adds a transformation when a transformation is clicked in the drawer and there are transformations', async () => {
    const onChangeTransformation = jest.fn();
    const modelMock = createModelMock(
      mockData,
      [
        {
          id: 'calculateField',
          options: {},
        },
      ],
      onChangeTransformation
    );
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);
    const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
    await userEvent.click(addButton);
    const transformationCard = await screen.findByTestId(
      selectors.components.TransformTab.newTransform('Add field from calculation')
    );
    const button = transformationCard.getElementsByTagName('button').item(0);
    await userEvent.click(button!);
    expect(onChangeTransformation).toHaveBeenCalledWith([
      { id: 'calculateField', options: {} },
      { id: 'calculateField', options: {} },
    ]);
  });

  it('deletes all transformations', async () => {
    const onChangeTransformation = jest.fn();
    const modelMock = createModelMock(
      mockData,
      [
        {
          id: 'calculateField',
          options: {},
        },
      ],
      onChangeTransformation
    );
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);
    const removeButton = await screen.findByTestId(selectors.components.Transforms.removeAllTransformationsButton);
    await userEvent.click(removeButton);
    const confirmButton = await screen.findByTestId(selectors.pages.ConfirmModal.delete);
    await userEvent.click(confirmButton);

    expect(onChangeTransformation).toHaveBeenCalledWith([]);
  });

  it('can filter transformations in the drawer', async () => {
    const modelMock = createModelMock(mockData);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);
    const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
    await userEvent.click(addButton);

    const searchInput = await screen.findByTestId(selectors.components.Transforms.searchInput);

    await screen.findByTestId(selectors.components.TransformTab.newTransform('Reduce'));

    await userEvent.type(searchInput, 'add field');

    await screen.findByTestId(selectors.components.TransformTab.newTransform('Add field from calculation'));
    const reduce = screen.queryByTestId(selectors.components.TransformTab.newTransform('Reduce'));
    expect(reduce).toBeNull();
  });
});

function setupTabScene(panelId: string) {
  const scene = transformSaveModelToScene({ dashboard: testDashboard as unknown as DashboardDataDTO, meta: {} });
  const panel = findVizPanelByKey(scene, panelId)!;

  const transformsTab = new PanelDataTransformationsTab({ panelRef: panel.getRef() });
  transformsTab.activate();

  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  return { transformsTab };
}
