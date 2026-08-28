import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataTransformerConfig,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type ResolvedSystemTransformations,
  type TimeRange,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction, setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { PanelPluginTransformationsBehaviour } from '../../scene/PanelPluginTransformationsBehaviour';
import { getResolvedSystemTransformations, NO_SYSTEM_TRANSFORMATIONS } from '../../scene/systemTransformations';
import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import {
  extractLabels,
  frameWithLabels,
  mockSystemTransformationPlugins,
  registerPlugin,
  systemTransformationPluginImportUtils,
} from '../../utils/systemTransformationTestUtils';
import { activateFullSceneTree } from '../../utils/test-utils';
import { findVizPanelByKey } from '../../utils/utils';
import { testDashboard } from '../testfiles/testDashboard';

import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';

// FIXME: This file has test encapsulation issues, where failures in one test can cascade to other tests.

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) => mockSystemTransformationPlugins.get(id),
  importPanelPlugin: (id: string) => Promise.resolve(mockSystemTransformationPlugins.get(id)),
}));

setPluginImportUtils(systemTransformationPluginImportUtils);

function createModelMock(
  panelData: PanelData,
  transformations?: DataTransformerConfig[],
  onChangeTransformationsMock?: Function,
  systemTransformations?: Partial<ResolvedSystemTransformations>
) {
  return {
    getDataTransformer: () => new SceneDataTransformer({ data: panelData, transformations: transformations || [] }),
    getQueryRunner: () => new SceneQueryRunner({ queries: [], data: panelData }),
    onChangeTransformations: onChangeTransformationsMock,
    // The real accessor resolves the panel plugin's supplier; this mock has no panel, so the
    // resolved result is supplied directly.
    getResolvedSystemTransformations: () =>
      systemTransformations ? { ...NO_SYSTEM_TRANSFORMATIONS, ...systemTransformations } : NO_SYSTEM_TRANSFORMATIONS,
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

/** The query result a plugin's transformations run against, for the tests that resolve them for real. */
const rawData: PanelData = {
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [frameWithLabels()],
};

/** Organize fields renders one row per field it is given, so its editor names the input's fields. */
const organize: DataTransformerConfig = { id: 'organize', options: {} };

/**
 * Unlike {@link createModelMock}, this activates a real scene so the plugin's supplier is registered
 * and the real resolver answers, rather than stubbing what the resolver would have returned.
 */
function createModelWithActivatedPlugin(pluginId: string, userTransformations: DataTransformerConfig[] = [organize]) {
  // Needs a source to activate against; the tab reads the raw frames from the query runner below.
  const transformer = new SceneDataTransformer({
    $data: new SceneDataNode({ data: rawData }),
    transformations: userTransformations,
    $behaviors: [new PanelPluginTransformationsBehaviour()],
  });
  // Activating parents the transformer and is what registers the plugin's supplier.
  activateFullSceneTree(new VizPanel({ pluginId, $data: transformer }));

  return {
    getDataTransformer: () => transformer,
    getQueryRunner: () => new SceneQueryRunner({ queries: [], data: rawData }),
    onChangeTransformations: jest.fn(),
    // Delegates for real rather than stubbing a result, so these tests exercise the resolver the
    // pipeline uses, unwrapped exactly as the tab unwraps it.
    getResolvedSystemTransformations: () => getResolvedSystemTransformations(transformer),
  } as unknown as PanelDataTransformationsTab;
}

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

  describe('system transformation rows', () => {
    it('renders them as read-only rows around the user transformations', async () => {
      const modelMock = createModelMock(mockData, [{ id: 'calculateField', options: {} }], jest.fn(), {
        prepend: [{ id: 'limit', options: {} }],
        append: [{ id: 'reduce', options: {} }],
      });
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      const rows = await screen.findAllByTestId(selectors.components.Transforms.systemTransformationRow);
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining('Limit'),
        expect.stringContaining('Reduce'),
      ]);

      // Read-only: no per-row remove button, unlike the user's editable row.
      expect(screen.getByText('1 - Add field from calculation')).toBeInTheDocument();
    });

    it('still offers the empty message when the plugin has transformations and the user has none', async () => {
      const modelMock = createModelMock(mockData, [], jest.fn(), { prepend: [{ id: 'limit', options: {} }] });
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      expect(await screen.findAllByTestId(selectors.components.Transforms.systemTransformationRow)).toHaveLength(1);
      // The suggested transformations, the SQL expression card and "Go to queries" live in here, and
      // the user has configured nothing — a panel type whose plugin registers transformations would
      // otherwise never show them.
      expect(screen.getByTestId(selectors.components.Transforms.noTransformationsMessage)).toBeInTheDocument();
      // Nothing of the user's to delete, so the destructive action is not offered.
      expect(
        screen.queryByTestId(selectors.components.Transforms.removeAllTransformationsButton)
      ).not.toBeInTheDocument();
    });

    it('labels an operator-form transformation as code defined', async () => {
      const modelMock = createModelMock(mockData, [], jest.fn(), { prepend: [() => (source) => source] });
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      const row = await screen.findByTestId(selectors.components.Transforms.systemTransformationRow);
      expect(row).toHaveTextContent('Custom transformation (code defined)');
    });

    it('is absent when the plugin registers nothing', async () => {
      const modelMock = createModelMock(mockData, [{ id: 'calculateField', options: {} }], jest.fn());
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      await screen.findByText('1 - Add field from calculation');
      expect(screen.queryByTestId(selectors.components.Transforms.systemTransformationRow)).not.toBeInTheDocument();
    });
  });

  describe('feeding the editor plugin-transformed fields', () => {
    beforeEach(() => {
      mockSystemTransformationPlugins.clear();
      setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('feeds the editor the fields the plugin transformations produce', async () => {
      registerPlugin('logs-table', (plugin) => plugin.setSystemTransformations(() => [extractLabels]));

      render(<PanelDataTransformationsTabRendered model={createModelWithActivatedPlugin('logs-table')} />);

      // `level` only exists because the plugin's extractFields ran first. Without it the user's
      // organize transformation is configured against a field set it will never receive.
      await waitFor(() => {
        expect(screen.getByText('level')).toBeInTheDocument();
      });
      expect(screen.getByText('labels')).toBeInTheDocument();
    });

    it('feeds the editor the raw query fields when the plugin registers none', async () => {
      registerPlugin('plain-table');

      render(<PanelDataTransformationsTabRendered model={createModelWithActivatedPlugin('plain-table')} />);

      await waitFor(() => {
        expect(screen.getByText('labels')).toBeInTheDocument();
      });
      expect(screen.queryByText('level')).not.toBeInTheDocument();
    });
  });

  describe('feeding the drawer the frames a new transformation will receive', () => {
    beforeEach(() => {
      mockSystemTransformationPlugins.clear();
      setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('judges applicability without the plugin appended transformations', async () => {
      // Appended, so it runs after every user transformation: a row added from the drawer is placed
      // ahead of it and never receives the `level` field it produces.
      registerPlugin('logs-table', (plugin) => plugin.setSystemTransformations(() => ({ append: [extractLabels] })));

      const model = createModelWithActivatedPlugin('logs-table', [
        { id: 'organize', options: { excludeByName: { line: true } } },
      ]);
      render(<PanelDataTransformationsTabRendered model={model} />);

      await userEvent.click(await screen.findByTestId(selectors.components.Transforms.addTransformationButton));
      const card = await screen.findByTestId(selectors.components.TransformTab.newTransform('Grouping to matrix'));

      // Two fields: the query's three, less the one the user's organize drops. The panel renders
      // three — `extractFields` puts `level` back — and judging against those would offer this
      // transformation as applicable to a row that will only ever see two.
      await waitFor(() =>
        expect(within(card).getByTestId(selectors.components.Transforms.applicabilityInfo)).toHaveAccessibleName(
          'Grouping to matrix requires at least 3 fields to work. Currently there are 2 fields.'
        )
      );
    });
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

    // Flush useHasBackendDatasource so setResolved is wrapped in act
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Add a Transformation')).toBeInTheDocument();
  });

  describe('transformation tracking', () => {
    beforeEach(() => {
      jest.mocked(reportInteraction).mockClear();
    });

    it('reports grafana_panel_transformations_clicked with action delete when user deletes a transformation', async () => {
      const onChangeTransformation = jest.fn();
      const modelMock = createModelMock(mockData, [{ id: 'calculateField', options: {} }], onChangeTransformation);
      render(<PanelDataTransformationsTabRendered model={modelMock}></PanelDataTransformationsTabRendered>);

      await screen.findByText('1 - Add field from calculation');
      const removeButton = screen.getByTestId(selectors.components.QueryEditorRow.actionButton('Remove'));
      await userEvent.click(removeButton);
      const confirmButton = await screen.findByTestId(selectors.pages.ConfirmModal.delete);
      await userEvent.click(confirmButton);

      // CUJ tracking emits a silent grafana_panel_edit_next_interaction alongside
      // the analytics event - filter to assert only the analytics call.
      const analyticsCalls = jest
        .mocked(reportInteraction)
        .mock.calls.filter((c) => c[0] === 'grafana_panel_transformations_clicked');
      expect(analyticsCalls).toHaveLength(1);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
        context: 'transformations_list',
        type: 'calculateField',
        action: 'delete',
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
        action: 'delete',
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
      });
    });
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
