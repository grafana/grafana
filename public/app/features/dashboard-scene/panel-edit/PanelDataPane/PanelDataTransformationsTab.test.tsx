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
import { reportInteraction } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../../utils/utils';
import { testDashboard } from '../testfiles/testDashboard';

import {
  PanelDataTransformationsTab,
  PanelDataTransformationsTabRendered,
  handleTransformationChange,
  handleTransformationRemove,
} from './PanelDataTransformationsTab';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

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

  it('renders the new empty transformations message with transformationsEmptyPlaceholder on', async () => {
    config.featureToggles.transformationsEmptyPlaceholder = true;
    const modelMock = createModelMock(mockData);
    render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

    // Should show SQL transformation card in empty state
    expect(screen.getByText('Add a Transformation')).toBeInTheDocument();
  });

  describe('transformation tracking', () => {
    beforeEach(() => {
      jest.mocked(reportInteraction).mockClear();
    });

    it('reports grafana_panel_transformations_clicked with action remove when user deletes a transformation', async () => {
      const onChangeTransformation = jest.fn();
      const modelMock = createModelMock(mockData, [{ id: 'calculateField', options: {} }], onChangeTransformation);
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      await screen.findByText('1 - Add field from calculation');
      const removeButton = screen.getByTestId(selectors.components.QueryEditorRow.actionButton('Remove'));
      await userEvent.click(removeButton);
      const confirmButton = await screen.findByTestId(selectors.pages.ConfirmModal.delete);
      await userEvent.click(confirmButton);

      expect(reportInteraction).toHaveBeenCalledTimes(1);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
        context: 'transformations_list',
        type: 'calculateField',
        action: 'remove',
        total_transformations: 0,
      });
    });

    it('reports total_transformations when user deletes one of multiple transformations', async () => {
      const onChangeTransformation = jest.fn();
      const modelMock = createModelMock(
        mockData,
        [
          { id: 'calculateField', options: {} },
          { id: 'organize', options: {} },
        ],
        onChangeTransformation
      );
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      await screen.findByText('1 - Add field from calculation');
      const removeButtons = screen.getAllByTestId(selectors.components.QueryEditorRow.actionButton('Remove'));
      await userEvent.click(removeButtons[0]);
      const confirmButton = await screen.findByTestId(selectors.pages.ConfirmModal.delete);
      await userEvent.click(confirmButton);

      expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
        context: 'transformations_list',
        type: 'calculateField',
        action: 'remove',
        total_transformations: 1,
      });
    });

    it('reports grafana_panel_transformations_clicked with action delete_all when user deletes all transformations', async () => {
      const onChangeTransformation = jest.fn();
      const modelMock = createModelMock(
        mockData,
        [
          { id: 'calculateField', options: {} },
          { id: 'organize', options: {} },
        ],
        onChangeTransformation
      );
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      await screen.findByText('1 - Add field from calculation');
      const removeAllButton = screen.getByTestId(selectors.components.Transforms.removeAllTransformationsButton);
      await userEvent.click(removeAllButton);
      const confirmButton = await screen.findByTestId(selectors.pages.ConfirmModal.delete);
      await userEvent.click(confirmButton);

      expect(reportInteraction).toHaveBeenCalledTimes(1);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
        context: 'transformations_list',
        action: 'delete_all',
        total_transformations: 0,
      });
    });
  });
});

describe('handleTransformationChange', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
  });

  it('reports edit interaction on first change at an index', () => {
    const reportedEdits = new Set<number>();
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [
      { id: 'calculateField', options: {} },
      { id: 'organize', options: {} },
    ];

    handleTransformationChange(
      0,
      { id: 'calculateField', options: { mode: 'binary' } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );

    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
      context: 'transformations_list',
      type: 'calculateField',
      action: 'edit',
    });
  });

  it('does not report edit interaction on subsequent changes at the same index', () => {
    const reportedEdits = new Set<number>();
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [{ id: 'calculateField', options: {} }];

    handleTransformationChange(
      0,
      { id: 'calculateField', options: { a: 1 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );
    handleTransformationChange(
      0,
      { id: 'calculateField', options: { a: 2 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );
    handleTransformationChange(
      0,
      { id: 'calculateField', options: { a: 3 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );

    expect(reportInteraction).toHaveBeenCalledTimes(1);
  });

  it('reports separately for different indices', () => {
    const reportedEdits = new Set<number>();
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [
      { id: 'calculateField', options: {} },
      { id: 'organize', options: {} },
    ];

    handleTransformationChange(
      0,
      { id: 'calculateField', options: { a: 1 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );
    handleTransformationChange(
      1,
      { id: 'organize', options: { b: 1 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );

    expect(reportInteraction).toHaveBeenCalledTimes(2);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
      context: 'transformations_list',
      type: 'calculateField',
      action: 'edit',
    });
    expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
      context: 'transformations_list',
      type: 'organize',
      action: 'edit',
    });
  });

  it('always calls onChangeTransformations regardless of dedup state', () => {
    const reportedEdits = new Set<number>();
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [{ id: 'calculateField', options: {} }];

    handleTransformationChange(
      0,
      { id: 'calculateField', options: { a: 1 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );
    handleTransformationChange(
      0,
      { id: 'calculateField', options: { a: 2 } },
      transformations,
      reportedEdits,
      onChangeTransformations
    );

    expect(onChangeTransformations).toHaveBeenCalledTimes(2);
    expect(onChangeTransformations).toHaveBeenNthCalledWith(1, [{ id: 'calculateField', options: { a: 1 } }]);
    expect(onChangeTransformations).toHaveBeenNthCalledWith(2, [{ id: 'calculateField', options: { a: 2 } }]);
  });
});

describe('handleTransformationRemove', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
  });

  it('reports remove interaction with correct type and remaining count', () => {
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [
      { id: 'calculateField', options: {} },
      { id: 'organize', options: {} },
    ];

    handleTransformationRemove(0, transformations, onChangeTransformations);

    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
      context: 'transformations_list',
      type: 'calculateField',
      action: 'remove',
      total_transformations: 1,
    });
  });

  it('reports total_transformations as 0 when removing the last transformation', () => {
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [{ id: 'calculateField', options: {} }];

    handleTransformationRemove(0, transformations, onChangeTransformations);

    expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
      context: 'transformations_list',
      type: 'calculateField',
      action: 'remove',
      total_transformations: 0,
    });
  });

  it('calls onChangeTransformations with the transformation removed', () => {
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [
      { id: 'calculateField', options: {} },
      { id: 'organize', options: {} },
      { id: 'reduce', options: {} },
    ];

    handleTransformationRemove(1, transformations, onChangeTransformations);

    expect(onChangeTransformations).toHaveBeenCalledTimes(1);
    expect(onChangeTransformations).toHaveBeenCalledWith([
      { id: 'calculateField', options: {} },
      { id: 'reduce', options: {} },
    ]);
  });

  it('does not mutate the original transformations array', () => {
    const onChangeTransformations = jest.fn();
    const transformations: DataTransformerConfig[] = [
      { id: 'calculateField', options: {} },
      { id: 'organize', options: {} },
    ];

    handleTransformationRemove(0, transformations, onChangeTransformations);

    expect(transformations).toHaveLength(2);
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

  return { transformsTab, panel };
}
