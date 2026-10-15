import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  CoreApp,
  createTheme,
  EventBusSrv,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  toDataFrame,
  standardTransformersRegistry,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, SceneDataTransformer, SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { TableCellDisplayMode, TableCellHeight, type TableOptions } from '@grafana/schema';
import { mockClientSize } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { PanelContextProvider } from '@grafana/ui';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { DashboardSceneChangeTracker } from 'app/features/dashboard-scene/saving/DashboardSceneChangeTracker';
import { createSavedPanelTransformations } from 'app/features/dashboard-scene/scene/SavedPanelTransformations';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { getPanelProps } from '../test-utils';

import { TablePanel } from './TablePanel';
import { plugin } from './module';

const options: TableOptions = { showHeader: true, cellHeight: TableCellHeight.Sm, frameIndex: 0, sortBy: [] };
const fieldConfig = { defaults: {}, overrides: [] };
function setup(empty = false) {
  const series = empty
    ? []
    : applyFieldOverrides({
        data: [toDataFrame({ fields: [{ name: 'Value', type: FieldType.number, values: [3, 1, 2] }] })],
        fieldConfig,
        theme: createTheme(),
        timeZone: 'utc',
        replaceVariables: (s) => s,
      });
  const props = getPanelProps(options, {
    fieldConfig,
    data: { series, state: LoadingState.Done, timeRange: getDefaultTimeRange() },
  });
  render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <TablePanel {...props} />
    </OpenFeatureProvider>
  );
  return props;
}

standardTransformersRegistry.setInit(getStandardTransformers);
standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);
setPluginImportUtils({
  importPanelPlugin: (id) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id) => (id === 'table' ? plugin : getPanelPlugin({ id })),
});

beforeAll(() => mockClientSize({ width: 800, height: 600 }));
afterEach(() => setTestFlags({}));

it.each(['defaults', 'override'])('preserves image cell %s when rebuilding ad-hoc source fields', (mode) => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
  const cellOptions = { type: TableCellDisplayMode.Image, alt: 'Server icon' };
  const imageConfig = {
    defaults: mode === 'defaults' ? { custom: { cellOptions } } : {},
    overrides:
      mode === 'override'
        ? [
            {
              matcher: { id: 'byName', options: 'Icon' },
              properties: [{ id: 'custom.cellOptions', value: cellOptions }],
            },
          ]
        : [],
  };
  const data = {
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
    series: [toDataFrame({ fields: [{ name: 'Icon', type: FieldType.string, values: ['/img/server.png'] }] })],
  };
  const source = new SceneDataNode({ data });
  const transformer = new SceneDataTransformer({ $data: source, transformations: [] });
  const panel = new VizPanel({ pluginId: 'table', $data: transformer });
  const api = panel.getRuntimeTransformations();
  const deactivate = transformer.activate();
  const props = getPanelProps(options, {
    fieldConfig: imageConfig,
    data: {
      ...data,
      series: applyFieldOverrides({
        data: data.series,
        fieldConfig: imageConfig,
        fieldConfigRegistry: plugin.fieldConfigRegistry,
        theme: createTheme(),
        replaceVariables: (value) => value,
      }),
    },
  });
  const view = render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <PanelContextProvider value={{ eventsScope: 'global', eventBus: new EventBusSrv(), adHocTransformations: api }}>
        <TablePanel {...props} />
      </PanelContextProvider>
    </OpenFeatureProvider>
  );
  try {
    expect(screen.getByRole('img', { name: 'Server icon' })).toHaveAttribute('src', '/img/server.png');
  } finally {
    view.unmount();
    deactivate();
  }
});

it('renders empty query results with refreshed features enabled', () => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
  setup(true);
  expect(screen.getByText('Unable to render data: .')).toBeInTheDocument();
});

it('shows and updates promoted columns in the saved transformation stack while editing', async () => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
  const frame = toDataFrame({
    fields: [
      { name: 'Value', type: FieldType.number, values: [1, 2] },
      { name: 'Extra', type: FieldType.string, values: ['first', 'visible after edit'] },
    ],
  });
  const source = new SceneDataNode({
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [frame] },
  });
  const transformer = new SceneDataTransformer({
    $data: source,
    transformations: [{ id: 'organize', options: { excludeByName: { Extra: true } } }],
  });
  const api = createSavedPanelTransformations(transformer, () => [frame]);
  const deactivate = transformer.activate();
  const props = getPanelProps<TableOptions>(
    { ...options, showColumnsSidebar: true },
    { fieldConfig, width: 800, height: 600 }
  );
  function LiveTable() {
    const { data } = transformer.useState();
    return data ? (
      <TablePanel
        {...props}
        data={{
          ...data,
          series: applyFieldOverrides({
            data: data.series,
            fieldConfig,
            fieldConfigRegistry: plugin.fieldConfigRegistry,
            theme: createTheme(),
            replaceVariables: props.replaceVariables,
          }),
        }}
      />
    ) : null;
  }

  const view = render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <PanelContextProvider
        value={{
          app: CoreApp.PanelEditor,
          eventsScope: 'global',
          eventBus: new EventBusSrv(),
          adHocTransformations: api,
        }}
      >
        <LiveTable />
      </PanelContextProvider>
    </OpenFeatureProvider>
  );
  try {
    await screen.findByRole('columnheader', { name: 'Value' });
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Value']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Extra' }));
    await waitFor(() =>
      expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Value', 'Extra'])
    );
    expect(transformer.state.transformations).toEqual([]);

    await userEvent.click(screen.getByLabelText('Column options for Value'));
    await userEvent.click(await screen.findByText('Filter values'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Minimum' }), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(transformer.state.data?.series[0].fields[0].values).toEqual([2]));
    expect(transformer.state.transformations.map((config) => ('id' in config ? config.id : undefined))).toEqual([
      'filterByValue',
    ]);
  } finally {
    view.unmount();
    deactivate();
  }
});

it('retains saved-sort callbacks with experimental features enabled', async () => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
  const props = setup();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Value' }));
  expect(screen.getAllByRole('gridcell').map((cell) => cell.textContent)).toEqual(['1', '2', '3']);
  expect(props.onOptionsChange).toHaveBeenCalledWith({ ...options, sortBy: [{ displayName: 'Value', desc: false }] });
});

it('retains saved-sort callbacks with experimental features disabled', async () => {
  const props = setup();
  await userEvent.setup().click(screen.getByRole('columnheader', { name: 'Value' }));
  expect(props.onOptionsChange).toHaveBeenCalledWith({ ...options, sortBy: [{ displayName: 'Value', desc: false }] });
});

it.each(['hide-first', 'filter-first'])(
  'composes %s filtering, reordering and hiding in Scenes without saving panel options',
  async (order) => {
    setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
    const source = new SceneDataNode({
      data: {
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        series: [
          toDataFrame({
            fields: [
              { name: 'Label', type: FieldType.string, values: ['three', 'one', 'two'] },
              { name: 'Value', type: FieldType.number, values: [3, 1, 2] },
              { name: 'Extra', type: FieldType.string, values: ['a', 'b', 'c'] },
            ],
          }),
        ],
      },
    });
    const transformer = new SceneDataTransformer({ $data: source, transformations: [] });
    const panel = new VizPanel({ pluginId: 'table', $data: transformer });
    const api = panel.getRuntimeTransformations();
    const deactivate = transformer.activate();
    const persistedEvents: SceneObjectStateChangedEvent[] = [];
    const subscription = panel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
        persistedEvents.push(event);
      }
    });
    const props = getPanelProps<TableOptions>(
      { ...options, showColumnsSidebar: true },
      { fieldConfig, width: 800, height: 600 }
    );
    function LiveTable() {
      const { data } = transformer.useState();
      return <TablePanel {...props} data={data!} />;
    }
    const rendered = render(
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <PanelContextProvider value={{ eventsScope: 'global', eventBus: new EventBusSrv(), adHocTransformations: api }}>
          <LiveTable />
        </PanelContextProvider>
      </OpenFeatureProvider>
    );
    const user = userEvent.setup();
    const hide = async (name: string) => {
      await user.click(screen.getByRole('checkbox', { name: `Hide ${name}` }));
    };
    try {
      if (order === 'hide-first') {
        await hide('Extra');
      }
      await user.click(screen.getByLabelText('Column options for Value'));
      await user.click(await screen.findByText('Filter values'));
      await user.type(screen.getByRole('textbox', { name: 'Minimum' }), '2');
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      screen.getByRole('button', { name: 'Reorder Value' }).focus();
      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(transformer.state.data?.series[0].fields[0].name).toBe('Value'));
      if (order === 'filter-first') {
        await hide('Extra');
      }
      await hide('Value');
      await waitFor(() =>
        expect(transformer.state.data?.series[0].fields.map((f) => ({ name: f.name, values: f.values }))).toEqual([
          { name: 'Label', values: ['three', 'two'] },
        ])
      );
      expect(screen.getAllByRole('gridcell').map((cell) => cell.textContent)).toEqual(['three', 'two']);
      expect(screen.getAllByRole('columnheader')[0]).not.toHaveClass('rdg-cell-frozen');
      expect(api.get('grafana:table-view').map((config) => config.id)).toEqual(['filterByValue', 'organize']);
      expect(api.getSourceSeries('grafana:table-view')[0].fields[1].values).toEqual([3, 1, 2]);
      expect(transformer.state.transformations).toEqual([]);
      expect(props.onOptionsChange).not.toHaveBeenCalled();
      expect(persistedEvents).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'Clear filters (1)' }));
      await waitFor(() => expect(transformer.state.data?.series[0].fields[0].values).toEqual(['three', 'one', 'two']));
      expect(screen.getAllByRole('gridcell').map((cell) => cell.textContent)).toEqual(['three', 'one', 'two']);

      await user.click(screen.getByRole('checkbox', { name: 'Show Value' }));
      await waitFor(() =>
        expect(transformer.state.data?.series[0].fields.map((f) => f.name)).toEqual(['Value', 'Label'])
      );
      expect(screen.getAllByRole('columnheader')[0]).not.toHaveClass('rdg-cell-frozen');
      expect(props.onOptionsChange).not.toHaveBeenCalled();
      expect(persistedEvents).toEqual([]);

      const previous = api.get('grafana:table-view');
      act(() => api.set('grafana:table-view', [...previous, { id: 'limit', options: { limitField: 1 } }]));
      await waitFor(() => expect(transformer.state.data?.series[0].fields[1].values).toEqual(['three']));
      expect(api.get('grafana:table-view').map((config) => config.id)).toEqual(['organize', 'limit']);
      act(() => api.set('grafana:table-view', previous));
      await waitFor(() => expect(transformer.state.data?.series[0].fields[1].values).toEqual(['three', 'one', 'two']));
    } finally {
      rendered.unmount();
      subscription.unsubscribe();
      deactivate();
    }
  }
);

it('restores pin-driven organize state in a fresh panel independently of frozen-column options', async () => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
  const mount = (serialized = '[]', frozenColumns = 0) => {
    const source = new SceneDataNode({
      data: {
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        series: [
          toDataFrame({
            fields: [
              { name: 'Label', type: FieldType.string, values: ['one'] },
              { name: 'Value', type: FieldType.number, values: [1] },
              { name: 'Extra', type: FieldType.string, values: ['a'] },
            ],
          }),
        ],
      },
    });
    const transformer = new SceneDataTransformer({ $data: source, transformations: [] });
    const panel = new VizPanel({ pluginId: 'table', $data: transformer });
    const api = panel.getRuntimeTransformations();
    api.set('grafana:table-view', JSON.parse(serialized));
    const deactivate = transformer.activate();
    const props = getPanelProps<TableOptions>(
      { ...options, showColumnsSidebar: true, frozenColumns: { left: frozenColumns } },
      { fieldConfig, width: 800, height: 600 }
    );
    function LiveTable() {
      const { data } = transformer.useState();
      if (!data) {
        return null;
      }
      const series = applyFieldOverrides({
        data: data.series,
        fieldConfig,
        theme: createTheme(),
        replaceVariables: (s) => s,
      });
      return <TablePanel {...props} data={{ ...data, series }} />;
    }
    const rendered = render(
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <PanelContextProvider value={{ eventsScope: 'global', eventBus: new EventBusSrv(), adHocTransformations: api }}>
          <LiveTable />
        </PanelContextProvider>
      </OpenFeatureProvider>
    );
    let disposed = false;
    return {
      api,
      transformer,
      props,
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        rendered.unmount();
        deactivate();
      },
    };
  };
  const user = userEvent.setup();
  let view = mount();
  try {
    await user.click(await screen.findByRole('button', { name: 'Pin Value' }));
    const serialized = JSON.stringify(view.api.get('grafana:table-view'));
    expect(JSON.parse(serialized)).toEqual([
      {
        id: 'organize',
        options: { indexByName: { Value: 0, Label: 1, Extra: 2 }, excludeByName: {}, renameByName: {} },
      },
    ]);
    await waitFor(() =>
      expect(view.transformer.state.data?.series[0].fields.map((field) => field.name)).toEqual([
        'Value',
        'Label',
        'Extra',
      ])
    );
    expect(view.props.onOptionsChange).not.toHaveBeenCalled();
    view.dispose();

    // Restore only transformations: order survives, but freezing belongs to a separate options layer.
    view = mount(serialized);
    await waitFor(() => expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Value'));
    expect(screen.getAllByRole('columnheader')[0]).not.toHaveClass('rdg-cell-frozen-start');
    expect(view.api.getSourceSeries('grafana:table-view')[0].fields.map((field) => field.name)).toEqual([
      'Label',
      'Value',
      'Extra',
    ]);
    view.dispose();

    view = mount(serialized, 1);
    await waitFor(() => expect(screen.getAllByRole('columnheader')[0]).toHaveClass('rdg-cell-frozen-start'));
    await user.click(screen.getByRole('button', { name: 'Unpin Value' }));
    expect(screen.getAllByRole('columnheader')[0]).not.toHaveClass('rdg-cell-frozen-start');
    expect(JSON.stringify(view.api.get('grafana:table-view'))).toBe(serialized);
    expect(view.props.onOptionsChange).not.toHaveBeenCalled();
  } finally {
    view.dispose();
  }
});
