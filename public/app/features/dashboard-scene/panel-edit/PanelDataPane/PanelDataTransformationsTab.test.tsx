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
import { DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../../utils/utils';
import { testDashboard } from '../testfiles/testDashboard';

import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';

// Mock getDataSourceSrv
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getDataSourceSrv: jest.fn(() => ({
      getInstanceSettings: jest.fn(),
    })),
  };
});

const getDataSourceSrvMock = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

// Helper to create DataSourceSrv mock with custom getInstanceSettings
const createMockDataSourceSrv = (
  getInstanceSettingsFn: (ref: { uid?: string; type?: string } | undefined) => unknown
): DataSourceSrv =>
  ({
    get: jest.fn(),
    getList: jest.fn(),
    getInstanceSettings: getInstanceSettingsFn,
    reload: jest.fn(),
    registerRuntimeDataSource: jest.fn(),
  }) as unknown as DataSourceSrv;

function createModelMock(
  panelData: PanelData,
  transformations?: DataTransformerConfig[],
  onChangeTransformationsMock?: Function,
  queries: Array<{ refId: string; datasource?: { uid?: string; type?: string } }> = []
) {
  return {
    getDataTransformer: () => new SceneDataTransformer({ data: panelData, transformations: transformations || [] }),
    getQueryRunner: () => new SceneQueryRunner({ queries, data: panelData }),
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

  it('renders SQL transformation card in empty state when feature toggles are enabled', async () => {
    const originalTransformationsToggle = config.featureToggles.transformationsEmptyPlaceholder;
    const originalSqlToggle = config.featureToggles.sqlExpressions;

    config.featureToggles.transformationsEmptyPlaceholder = true;
    config.featureToggles.sqlExpressions = true;

    try {
      const modelMock = createModelMock(mockData);
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      // Should show SQL transformation card in empty state
      expect(screen.getByText('Transform with SQL')).toBeInTheDocument();
      expect(screen.getByTestId('go-to-queries-button')).toBeInTheDocument();
    } finally {
      config.featureToggles.transformationsEmptyPlaceholder = originalTransformationsToggle;
      config.featureToggles.sqlExpressions = originalSqlToggle;
    }
  });

  it('does not render SQL transformation card when sqlExpressions toggle is disabled', async () => {
    const originalTransformationsToggle = config.featureToggles.transformationsEmptyPlaceholder;
    const originalSqlToggle = config.featureToggles.sqlExpressions;

    config.featureToggles.transformationsEmptyPlaceholder = true;
    config.featureToggles.sqlExpressions = false;

    try {
      const modelMock = createModelMock(mockData);
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      // Should not show SQL transformation card
      expect(screen.queryByText('SQL Expressions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('go-to-queries-button')).not.toBeInTheDocument();
    } finally {
      config.featureToggles.transformationsEmptyPlaceholder = originalTransformationsToggle;
      config.featureToggles.sqlExpressions = originalSqlToggle;
    }
  });
});

describe('SQL Expression applicability', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  let originalTransformationsToggle: boolean | undefined;
  let originalSqlToggle: boolean | undefined;

  beforeEach(() => {
    originalTransformationsToggle = config.featureToggles.transformationsEmptyPlaceholder;
    originalSqlToggle = config.featureToggles.sqlExpressions;
    config.featureToggles.transformationsEmptyPlaceholder = true;
    config.featureToggles.sqlExpressions = true;
  });

  afterEach(() => {
    config.featureToggles.transformationsEmptyPlaceholder = originalTransformationsToggle;
    config.featureToggles.sqlExpressions = originalSqlToggle;
    jest.clearAllMocks();
  });

  // Helper to check if the info icon button is present (rendered when disabled)
  // The IconButton for info renders as a button with an SVG icon
  // When disabled, there are 2 buttons: the card button and the info icon button
  const getInfoIconButton = (container: HTMLElement) => {
    const buttons = container.querySelectorAll('button');
    return buttons.length > 1 ? buttons[1] : null;
  };

  it('should enable SQL card when datasource is a backend datasource', async () => {
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv(() => ({
        uid: 'prometheus',
        name: 'Prometheus',
        meta: { backend: true },
      }))
    );

    const modelMock = createModelMock(mockData, [], undefined, [
      { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
    ]);

    render(<PanelDataTransformationsTabRendered model={modelMock} />);

    const sqlCard = await screen.findByTestId('go-to-queries-button');
    // Card should NOT have disabled background styling - check it's clickable
    expect(sqlCard).toBeInTheDocument();
    // The card should not show the disabled info icon button
    expect(getInfoIconButton(sqlCard)).toBeNull();
  });

  it('should disable SQL card when datasource is frontend-only', async () => {
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv(() => ({
        uid: 'googlesheets',
        name: 'Google Sheets',
        meta: { backend: false, isBackend: false },
      }))
    );

    const modelMock = createModelMock(mockData, [], undefined, [
      { refId: 'A', datasource: { uid: 'googlesheets', type: 'grafana-googlesheets-datasource' } },
    ]);

    render(<PanelDataTransformationsTabRendered model={modelMock} />);

    const sqlCard = await screen.findByTestId('go-to-queries-button');
    // Card should show the disabled info icon button
    expect(getInfoIconButton(sqlCard)).toBeInTheDocument();
  });

  it('should enable SQL card when datasource settings cannot be found', async () => {
    // Return undefined for getInstanceSettings - simulating unknown datasource
    getDataSourceSrvMock.mockReturnValue(createMockDataSourceSrv(() => undefined));

    const modelMock = createModelMock(mockData, [], undefined, [
      { refId: 'A', datasource: { uid: 'unknown-ds', type: 'unknown' } },
    ]);

    render(<PanelDataTransformationsTabRendered model={modelMock} />);

    const sqlCard = await screen.findByTestId('go-to-queries-button');
    // Card should NOT be disabled when we can't determine datasource type
    expect(getInfoIconButton(sqlCard)).toBeNull();
  });

  it('should skip expression queries when checking SQL applicability', async () => {
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv((ref) => {
        if (ref?.uid === ExpressionDatasourceUID) {
          // Expression datasource - this should be skipped
          return { uid: ExpressionDatasourceUID, name: 'Expression', meta: { backend: false } };
        }
        // Backend datasource
        return { uid: 'prometheus', name: 'Prometheus', meta: { backend: true } };
      })
    );

    const modelMock = createModelMock(mockData, [], undefined, [
      { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: ExpressionDatasourceUID, type: '__expr__' } }, // Expression query
    ]);

    render(<PanelDataTransformationsTabRendered model={modelMock} />);

    const sqlCard = await screen.findByTestId('go-to-queries-button');
    // Should still be enabled because expression queries are skipped
    expect(getInfoIconButton(sqlCard)).toBeNull();
  });

  it('should disable SQL card if any non-expression query uses frontend-only datasource', async () => {
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv((ref) => {
        if (ref?.uid === 'googlesheets') {
          return { uid: 'googlesheets', name: 'Google Sheets', meta: { backend: false, isBackend: false } };
        }
        return { uid: 'prometheus', name: 'Prometheus', meta: { backend: true } };
      })
    );

    const modelMock = createModelMock(mockData, [], undefined, [
      { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'googlesheets', type: 'grafana-googlesheets-datasource' } },
    ]);

    render(<PanelDataTransformationsTabRendered model={modelMock} />);

    const sqlCard = await screen.findByTestId('go-to-queries-button');
    // Card should be disabled because one datasource is frontend-only
    expect(getInfoIconButton(sqlCard)).toBeInTheDocument();
  });

  it('should enable SQL card when there are no queries', async () => {
    getDataSourceSrvMock.mockReturnValue(createMockDataSourceSrv(() => undefined));

    const modelMock = createModelMock(mockData, [], undefined, []);

    render(<PanelDataTransformationsTabRendered model={modelMock} />);

    const sqlCard = await screen.findByTestId('go-to-queries-button');
    // Card should be enabled when there are no queries
    expect(getInfoIconButton(sqlCard)).toBeNull();
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
