import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
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

it('retains saved-sort callbacks with experimental features disabled', async () => {
  const props = setup();
  await userEvent.setup().click(screen.getByRole('columnheader', { name: 'Value' }));
  expect(props.onOptionsChange).toHaveBeenCalledWith({ ...options, sortBy: [{ displayName: 'Value', desc: false }] });
});

it.each(['hide-first', 'filter-first'])(
  'composes %s table controls in the Scenes pipeline and keeps the dashboard clean',
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
      await user.click(screen.getByRole('checkbox', { name: '3' }));
      await user.click(screen.getByRole('checkbox', { name: '2' }));
      await user.click(screen.getByRole('button', { name: 'Ok' }));
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
      expect(api.get().map((config) => config.id)).toEqual(['filterByValue', 'organize']);
      expect(api.getSourceSeries()[0].fields[1].values).toEqual([3, 1, 2]);
      expect(transformer.state.transformations).toEqual([]);
      expect(props.onOptionsChange).not.toHaveBeenCalled();
      expect(persistedEvents).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'Clear filters (1)' }));
      await waitFor(() => expect(transformer.state.data?.series[0].fields[0].values).toEqual(['three', 'one', 'two']));
      expect(screen.getAllByRole('gridcell').map((cell) => cell.textContent)).toEqual(['three', 'one', 'two']);

      const previous = api.get();
      act(() => api.set([...previous, { id: 'limit', options: { limitField: 1 } }]));
      await waitFor(() => expect(transformer.state.data?.series[0].fields[0].values).toEqual(['three']));
      expect(api.get().map((config) => config.id)).toEqual(['organize', 'limit']);
      act(() => api.set(previous));
      await waitFor(() => expect(transformer.state.data?.series[0].fields[0].values).toEqual(['three', 'one', 'two']));
    } finally {
      rendered.unmount();
      subscription.unsubscribe();
      deactivate();
    }
  }
);
