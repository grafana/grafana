import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  EventBusSrv,
  type FieldConfigSource,
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

      await user.click(screen.getByRole('checkbox', { name: 'Show Value' }));
      await user.click(screen.getByLabelText('Column options for Value'));
      await user.click(await screen.findByText('Update filter'));
      await user.click(screen.getByRole('button', { name: 'Clear filter' }));
      await hide('Value');
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

describe('fit-content max height', () => {
  const pagedOptions: TableOptions = { ...options, enablePagination: true };

  function makeRowsFrame(rowCount: number, name: string): DataFrame {
    return toDataFrame({
      name,
      fields: [
        {
          name: 'Index',
          type: FieldType.number,
          values: Array.from({ length: rowCount }, (_, i) => i + 1),
        },
        { name: 'Label', type: FieldType.string, values: Array.from({ length: rowCount }, (_, i) => `row-${i + 1}`) },
      ],
    });
  }

  function renderFitContentTable({
    series,
    fitMaxHeight,
    tableOptions = pagedOptions,
    tableFieldConfig = fieldConfig,
    fitContent = true,
  }: {
    series: DataFrame[];
    fitMaxHeight?: number;
    tableOptions?: TableOptions;
    tableFieldConfig?: FieldConfigSource;
    fitContent?: boolean;
  }) {
    const withOverrides = applyFieldOverrides({
      data: series,
      fieldConfig: tableFieldConfig,
      theme: createTheme(),
      timeZone: 'utc',
      replaceVariables: (s: string) => s,
    });
    const props = getPanelProps(tableOptions, {
      fieldConfig: tableFieldConfig,
      width: 800,
      data: { series: withOverrides, state: LoadingState.Done, timeRange: getDefaultTimeRange() },
      fitContent,
      fitMaxHeight,
    });
    return render(
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <TablePanel {...props} />
      </OpenFeatureProvider>
    );
  }

  const dataRowCount = (container: HTMLElement) => container.querySelectorAll('.rdg-row:not(.rdg-header-row)').length;

  it('fits auto-sized pages inside fitMaxHeight', () => {
    // 50 small rows: natural height 1836px, capped at 320px -> 6 rows per page across 9 pages.
    const { container } = renderFitContentTable({ series: [makeRowsFrame(50, 'frame')], fitMaxHeight: 320 });
    expect(dataRowCount(container)).toBe(6);
    expect(screen.getByRole('button', { name: '9' })).toBeInTheDocument();
  });

  it('renders rows with no pagination chrome when uncapped', () => {
    const { container } = renderFitContentTable({ series: [makeRowsFrame(50, 'frame')] });
    // no derived page size without a height bound: no page buttons, no summary,
    // and more rows rendered than the capped 6-per-page (virtualized to the mock viewport)
    expect(dataRowCount(container)).toBeGreaterThan(6);
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    expect(screen.queryByText(/of 50 rows/)).not.toBeInTheDocument();
  });

  it('keeps an explicit page size when uncapped', () => {
    setTestFlags({ [FlagKeys.TablePaginationPageSize]: true });
    const { container } = renderFitContentTable({
      series: [makeRowsFrame(50, 'frame')],
      tableOptions: { ...pagedOptions, pageSize: 5 },
    });
    expect(dataRowCount(container)).toBe(5);
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('stacks the frame picker below unpaginated content for uncapped multi-frame tables', () => {
    const { container } = renderFitContentTable({
      series: [makeRowsFrame(50, 'a'), makeRowsFrame(50, 'b')],
    });
    const picker = screen.getByRole('combobox', { name: 'Query' });
    expect(picker).toBeInTheDocument();
    // the picker stacks below the grid: the first data row precedes it in DOM order
    const firstRow = container.querySelector('.rdg-row:not(.rdg-header-row)');
    expect(firstRow).not.toBeNull();
    expect(firstRow!.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dataRowCount(container)).toBeGreaterThan(6);
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    expect(screen.queryByText(/of 50 rows/)).not.toBeInTheDocument();
  });

  it('reserves frame picker space within the cap', () => {
    const { container } = renderFitContentTable({
      series: [makeRowsFrame(50, 'a'), makeRowsFrame(50, 'b')],
      fitMaxHeight: 320,
    });
    expect(screen.getByRole('combobox', { name: 'Query' })).toBeInTheDocument();
    // The picker reserve leaves room for 5 rows per page instead of 6: 10 pages, not 9.
    expect(dataRowCount(container)).toBe(5);
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('renders multi-frame tables at fixed height with a picker', () => {
    const { container } = renderFitContentTable({
      series: [makeRowsFrame(50, 'a'), makeRowsFrame(50, 'b')],
      fitContent: false,
    });
    expect(screen.getByRole('combobox', { name: 'Query' })).toBeInTheDocument();
    expect(dataRowCount(container)).toBeGreaterThan(0);
  });

  it('renders the picker without panel padding under table refresh', () => {
    setTestFlags({ [FlagKeys.TableRefresh]: true });
    const capped = renderFitContentTable({
      series: [makeRowsFrame(50, 'a'), makeRowsFrame(50, 'b')],
      fitMaxHeight: 320,
    });
    expect(screen.getByRole('combobox', { name: 'Query' })).toBeInTheDocument();
    capped.unmount();
    renderFitContentTable({
      series: [makeRowsFrame(50, 'a'), makeRowsFrame(50, 'b')],
    });
    expect(screen.getByRole('combobox', { name: 'Query' })).toBeInTheDocument();
  });

  it('honours a configured page size under a cap', () => {
    setTestFlags({ [FlagKeys.TablePaginationPageSize]: true });
    const { container } = renderFitContentTable({
      series: [makeRowsFrame(50, 'frame')],
      fitMaxHeight: 320,
      tableOptions: { ...pagedOptions, pageSize: 5 },
    });
    expect(dataRowCount(container)).toBe(5);
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('renders full wrapped text and paginates against the cap', () => {
    const series = [
      toDataFrame({
        name: 'frame',
        fields: [
          {
            name: 'Note',
            type: FieldType.string,
            values: Array.from({ length: 50 }, (_, i) => `a much longer wrapped value for row number ${i + 1}`),
          },
        ],
      }),
    ];
    const wrappedFieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'Note' },
          properties: [{ id: 'custom.wrapText', value: true }],
        },
      ],
    };
    const { container } = renderFitContentTable({ series, fitMaxHeight: 320, tableFieldConfig: wrappedFieldConfig });
    // wrapText applies (full text rendered) and capped pagination still works.
    // Counts stay estimate-driven here by construction, so wrap cannot change
    // them in jsdom; the taller-rows-fewer-per-page effect is proven instead by
    // the browser-level fit-content suite, which measures real layout.
    expect(screen.getByText('a much longer wrapped value for row number 1')).toBeInTheDocument();
    expect(dataRowCount(container)).toBe(6);
    expect(screen.getByRole('button', { name: '9' })).toBeInTheDocument();
  });

  it('derives fewer rows per page from taller row-height input', () => {
    // sm (36px) fits 6 rows per page under the 320px cap; lg (60px) must fit
    // fewer. Proves page-size derivation honors row-height differences through
    // a real option; that wrapped text produces taller rows is proven by the
    // browser-level suite's real layout.
    const { container } = renderFitContentTable({
      series: [makeRowsFrame(50, 'frame')],
      fitMaxHeight: 320,
      tableOptions: { ...pagedOptions, cellHeight: TableCellHeight.Lg },
    });
    expect(dataRowCount(container)).toBe(5);
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('paginates expanded nested rows under a cap', async () => {
    const nested = applyFieldOverrides({
      data: [
        toDataFrame({
          name: 'NestedData',
          fields: [
            { name: 'Nested A', type: FieldType.string, values: ['N1', 'N2'] },
            { name: 'Nested B', type: FieldType.number, values: [10, 20] },
          ],
        }),
      ],
      fieldConfig: { defaults: {}, overrides: [] },
      theme: createTheme(),
      timeZone: 'utc',
      replaceVariables: (s: string) => s,
    })[0];
    const parent = toDataFrame({
      name: 'frame',
      fields: [
        { name: 'Column A', type: FieldType.string, values: Array.from({ length: 8 }, (_, i) => `A${i + 1}`) },
        { name: 'Column B', type: FieldType.number, values: Array.from({ length: 8 }, (_, i) => i + 1) },
        {
          name: '__depth',
          type: FieldType.number,
          values: Array(8).fill(0),
          config: { custom: { hideFrom: { viz: true } } },
        },
        {
          name: '__index',
          type: FieldType.number,
          values: Array.from({ length: 8 }, (_, i) => i),
          config: { custom: { hideFrom: { viz: true } } },
        },
        { name: '__nestedFrames', type: FieldType.nestedFrames, values: Array(8).fill([nested]) },
      ],
    });
    renderFitContentTable({ series: [parent], fitMaxHeight: 320 });
    // 8 parents at 6 rows per page: a second page, with the nested rows expandable inside the cap.
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Expand row' })[0]);
    expect(await screen.findByText('N1')).toBeInTheDocument();
    // the footer stays usable after expansion: summary visible, page 2 reachable
    expect(screen.getByText('1 - 6 of 8 rows')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText('A7')).toBeInTheDocument();
    expect(screen.getByText('7 - 8 of 8 rows')).toBeInTheDocument();
    expect(screen.queryByText('N1')).not.toBeInTheDocument();
  });
});
