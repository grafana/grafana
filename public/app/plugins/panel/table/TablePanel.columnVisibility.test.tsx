import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  CoreApp,
  createDataFrame,
  createTheme,
  EventBusSrv,
  FieldType,
  LoadingState,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  type DataTransformerConfig,
  type FieldConfigSource,
} from '@grafana/data';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { type TableOptions } from '@grafana/schema';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { PanelContextProvider } from '@grafana/ui';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { getPanelProps } from '../test-utils';

import { TablePanel } from './TablePanel';
import { plugin } from './module';

beforeAll(() => {
  mockBoundingClientRect({ width: 800, height: 600 });
  standardEditorsRegistry.setInit(getAllOptionEditors);
  standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);
  setPluginImportUtils({
    importPanelPlugin: async () => plugin,
    getPanelPluginFromCache: () => plugin,
  });
});

beforeEach(() => setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true }));
afterEach(() => setTestFlags({}));

const headers = () => screen.getAllByRole('columnheader').map((header) => header.textContent);

it('hides a column through the ad hoc transformations in panel edit', async () => {
  const source = createDataFrame({
    fields: ['A', 'B'].map((name) => ({ name, type: FieldType.number, values: [1] })),
  });
  const props = getPanelProps<TableOptions>(
    { frameIndex: 0, showHeader: true, showColumnsSidebar: true },
    { fieldConfig: { defaults: {}, overrides: [] }, width: 800 }
  );
  props.data.series = applyFieldOverrides({
    data: [source],
    fieldConfig: props.fieldConfig,
    fieldConfigRegistry: plugin.fieldConfigRegistry,
    theme: createTheme(),
    replaceVariables: props.replaceVariables,
  });
  const set = jest.fn();
  const transformations: DataTransformerConfig[] = [];

  render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <PanelContextProvider
        value={{
          app: CoreApp.PanelEditor,
          eventsScope: 'table',
          eventBus: new EventBusSrv(),
          adHocTransformations: {
            get: () => transformations,
            set,
            getSourceSeries: () => [source],
            subscribe: () => () => {},
          },
        }}
      >
        <TablePanel {...props} />
      </PanelContextProvider>
    </OpenFeatureProvider>
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'Hide B' }));

  expect(set).toHaveBeenCalledWith('grafana:table-view', [
    expect.objectContaining({ id: 'organize', options: expect.objectContaining({ excludeByName: { B: true } }) }),
  ]);
});

it('excludes override-hidden columns while retaining ad-hoc-hidden columns and protecting the last visible column', async () => {
  const source = createDataFrame({
    fields: ['A', 'B', 'C'].map((name) => ({ name, type: FieldType.number, values: [1, 2] })),
  });
  const sourceSeries = [source];
  const transformations = [{ id: 'organize', options: { excludeByName: { B: true } } }];
  const set = jest.fn();
  const table = (hideA: boolean) => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        { matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'custom.hideFrom.viz', value: hideA }] },
        { matcher: { id: 'byName', options: 'B' }, properties: [{ id: 'displayName', value: 'Renamed B' }] },
      ],
    };
    const props = getPanelProps<TableOptions>(
      { frameIndex: 0, showHeader: true, showColumnsSidebar: true },
      { fieldConfig, width: 800, replaceVariables: (value) => value }
    );
    props.data = {
      state: LoadingState.Done,
      timeRange: props.timeRange,
      series: applyFieldOverrides({
        data: [{ ...source, fields: source.fields.filter((field) => field.name !== 'B') }],
        fieldConfig,
        fieldConfigRegistry: plugin.fieldConfigRegistry,
        theme: createTheme(),
        replaceVariables: props.replaceVariables,
      }),
    };
    return (
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <PanelContextProvider
          value={{
            eventsScope: 'table',
            eventBus: new EventBusSrv(),
            adHocTransformations: {
              get: () => transformations,
              set,
              getSourceSeries: () => sourceSeries,
              subscribe: () => () => {},
            },
          }}
        >
          <TablePanel {...props} />
        </PanelContextProvider>
      </OpenFeatureProvider>
    );
  };
  const { rerender } = render(table(true));
  expect(headers()).toEqual(['C']);
  expect(screen.getByRole('checkbox', { name: 'Show Renamed B' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hide C' })).toBeDisabled();
  expect(screen.queryByRole('checkbox', { name: / A$/ })).not.toBeInTheDocument();
  expect(set).not.toHaveBeenCalled();

  rerender(table(false));
  expect(headers()).toEqual(['A', 'C']);
  expect(screen.getByRole('checkbox', { name: 'Hide A' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hide C' })).toBeEnabled();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Show Renamed B' }));
  expect(set).toHaveBeenCalledWith('grafana:table-view', []);
});

it('shows changed upstream column order without losing ad-hoc visibility', async () => {
  let source = createDataFrame({
    refId: 'A',
    fields: ['A', 'B', 'C'].map((name) => ({ name, type: FieldType.number, values: [1] })),
  });
  let transformations: readonly DataTransformerConfig[] = [
    {
      id: 'organize',
      filter: { id: 'byRefId', options: 'A' },
      options: { indexByName: { C: 0, A: 1, B: 2 }, excludeByName: { B: true } },
    },
  ];
  const listeners = new Set<() => void>();
  const set = jest.fn((_owner: string, next: readonly DataTransformerConfig[]) => {
    transformations = next;
    listeners.forEach((listener) => listener());
  });
  const adHocTransformations = {
    get: () => transformations,
    set,
    getSourceSeries: () => [source],
    subscribe: (_owner: string, listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const table = (hideA = false) => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        { matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'custom.hideFrom.viz', value: hideA }] },
      ],
    };
    const props = getPanelProps<TableOptions>(
      { frameIndex: 0, showHeader: true, showColumnsSidebar: true },
      { fieldConfig, width: 800, replaceVariables: (value) => value }
    );
    props.data = {
      state: LoadingState.Done,
      timeRange: props.timeRange,
      series: applyFieldOverrides({
        data: [source],
        fieldConfig,
        fieldConfigRegistry: plugin.fieldConfigRegistry,
        theme: createTheme(),
        replaceVariables: props.replaceVariables,
      }),
    };
    return (
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <PanelContextProvider value={{ eventsScope: 'table', eventBus: new EventBusSrv(), adHocTransformations }}>
          <TablePanel {...props} />
        </PanelContextProvider>
      </OpenFeatureProvider>
    );
  };

  const { rerender } = render(table());
  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['C', 'A']);
  expect(screen.getByRole('checkbox', { name: 'Show B' })).not.toBeChecked();

  rerender(table(true));
  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['C']);
  rerender(table(false));
  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['C', 'A']);
  expect(set).not.toHaveBeenCalled();

  source = { ...source, fields: [source.fields[1], source.fields[0], source.fields[2]] };
  rerender(table());

  await waitFor(() =>
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['A', 'C'])
  );
  expect(transformations[0].options).toEqual({
    indexByName: {},
    excludeByName: { B: true },
    renameByName: {},
    referenceByName: { B: { name: 'B' } },
  });
  expect(screen.getByRole('checkbox', { name: 'Show B' })).not.toBeChecked();
  expect(set).toHaveBeenCalledTimes(1);
});

it('keeps hidden and reordered columns on the same column when an upstream transformation renames it', async () => {
  let source = createDataFrame({
    refId: 'A',
    fields: ['host', 'region', 'value'].map((name) => ({ name, type: FieldType.string, values: [name] })),
  });
  let transformations: readonly DataTransformerConfig[] = [];
  const listeners = new Set<() => void>();
  const set = jest.fn((_owner: string, next: readonly DataTransformerConfig[]) => {
    transformations = next;
    listeners.forEach((listener) => listener());
  });
  const adHocTransformations = {
    get: () => transformations,
    set,
    getSourceSeries: () => [source],
    subscribe: (_owner: string, listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const table = () => {
    const props = getPanelProps<TableOptions>(
      { frameIndex: 0, showHeader: true, showColumnsSidebar: true },
      { fieldConfig: { defaults: {}, overrides: [] }, width: 800, replaceVariables: (value) => value }
    );
    props.data = {
      state: LoadingState.Done,
      timeRange: props.timeRange,
      series: applyFieldOverrides({
        data: [source],
        fieldConfig: props.fieldConfig,
        fieldConfigRegistry: plugin.fieldConfigRegistry,
        theme: createTheme(),
        replaceVariables: props.replaceVariables,
      }),
    };
    return (
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <PanelContextProvider value={{ eventsScope: 'table', eventBus: new EventBusSrv(), adHocTransformations }}>
          <TablePanel {...props} />
        </PanelContextProvider>
      </OpenFeatureProvider>
    );
  };

  const { rerender } = render(table());
  await userEvent.click(screen.getByRole('checkbox', { name: 'Hide host' }));
  await userEvent.click(screen.getByRole('button', { name: 'Reorder region' }));
  await userEvent.keyboard('{ArrowUp}');
  expect(headers()).toEqual(['region', 'value']);
  set.mockClear();

  source = {
    ...source,
    fields: source.fields.map((field) =>
      field.name === 'host'
        ? {
            ...field,
            config: { ...field.config, displayName: 'Host name' },
            state: { ...field.state, displayName: 'Host name' },
          }
        : field
    ),
  };
  rerender(table());

  expect(headers()).toEqual(['region', 'value']);
  expect(screen.getByRole('checkbox', { name: 'Show Host name' })).not.toBeChecked();
  expect(set).not.toHaveBeenCalled();
});

describe('with display name overrides', () => {
  const source = createDataFrame({
    refId: 'A',
    fields: [
      { name: 'customer_id', type: FieldType.string, values: ['customer-a', 'customer-b', 'customer-c'] },
      { name: 'region_name', type: FieldType.string, values: ['us-east', 'eu-west', 'us-east'] },
      { name: 'request_count', type: FieldType.number, values: [10, 20, 30] },
    ],
  });

  const withDisplayNames = (displayNames: Record<string, string>): FieldConfigSource => ({
    defaults: { custom: { filterable: true } },
    overrides: Object.entries(displayNames).map(([name, value]) => ({
      matcher: { id: 'byName', options: name },
      properties: [{ id: 'displayName', value }],
    })),
  });

  const renamed = withDisplayNames({ customer_id: 'Customer', region_name: 'Region', request_count: 'Requests' });

  function renderTable(fieldConfig: FieldConfigSource) {
    let transformations: readonly DataTransformerConfig[] = [];
    const listeners = new Set<() => void>();
    const adHocTransformations = {
      get: () => transformations,
      set: jest.fn((_owner: string, next: readonly DataTransformerConfig[]) => {
        transformations = next;
        listeners.forEach((listener) => listener());
      }),
      getSourceSeries: () => [source],
      subscribe: (_owner: string, listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const table = (config: FieldConfigSource) => {
      const props = getPanelProps<TableOptions>(
        { frameIndex: 0, showHeader: true, showColumnsSidebar: true },
        { fieldConfig: config, width: 800, replaceVariables: (value) => value }
      );
      props.data = {
        state: LoadingState.Done,
        timeRange: props.timeRange,
        series: applyFieldOverrides({
          data: [source],
          fieldConfig: config,
          fieldConfigRegistry: plugin.fieldConfigRegistry,
          theme: createTheme(),
          replaceVariables: props.replaceVariables,
        }),
      };
      return (
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <PanelContextProvider value={{ eventsScope: 'table', eventBus: new EventBusSrv(), adHocTransformations }}>
            <TablePanel {...props} />
          </PanelContextProvider>
        </OpenFeatureProvider>
      );
    };
    const { rerender } = render(table(fieldConfig));

    return {
      rerender: (config: FieldConfigSource) => rerender(table(config)),
      getColumns: () => transformations.find((config) => config.id === 'organize')?.options,
      set: adHocTransformations.set,
    };
  }

  const header = (name: string) => screen.getAllByRole('columnheader').find((header) => header.textContent === name)!;
  const sidebarOrder = () =>
    screen.getAllByRole('button', { name: /^Reorder / }).map((button) => button.getAttribute('aria-label'));
  const rows = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('gridcell')
          .map((cell) => cell.textContent)
      );

  it('hides and restores renamed columns from the sidebar and the header menu', async () => {
    const { getColumns } = renderTable(renamed);
    expect(headers()).toEqual(['Customer', 'Region', 'Requests']);
    expect(sidebarOrder()).toEqual(['Reorder Customer', 'Reorder Region', 'Reorder Requests']);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Hide Customer' }));
    expect(headers()).toEqual(['Region', 'Requests']);

    await userEvent.click(screen.getByLabelText('Column options for Requests'));
    await userEvent.click(await screen.findByText('Hide column'));
    expect(headers()).toEqual(['Region']);
    expect(getColumns()?.excludeByName).toEqual({ customer_id: true, request_count: true });
    expect(screen.getByRole('checkbox', { name: 'Hide Region' })).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Customer' }));
    expect(headers()).toEqual(['Customer', 'Region']);
    expect(getColumns()?.excludeByName).toEqual({ request_count: true });
  });

  it('reorders renamed columns by dragging a header and from the sidebar', async () => {
    const { getColumns } = renderTable(renamed);
    const dataTransfer = { dropEffect: '', setDragImage: jest.fn() };

    fireEvent.dragStart(header('Requests'), { dataTransfer });
    fireEvent.dragOver(header('Customer'), { dataTransfer });
    fireEvent.drop(header('Customer'), { dataTransfer });
    fireEvent.dragEnd(header('Requests'), { dataTransfer });
    expect(headers()).toEqual(['Requests', 'Customer', 'Region']);
    expect(getColumns()?.indexByName).toEqual({ request_count: 0, customer_id: 1, region_name: 2 });

    await userEvent.click(screen.getByRole('button', { name: 'Reorder Region' }));
    await userEvent.keyboard('{ArrowUp}');
    expect(headers()).toEqual(['Requests', 'Region', 'Customer']);
    expect(sidebarOrder()).toEqual(['Reorder Requests', 'Reorder Region', 'Reorder Customer']);
    expect(getColumns()?.indexByName).toEqual({ request_count: 0, region_name: 1, customer_id: 2 });
  });

  it('filters rows by a renamed column while other columns are hidden and reordered', async () => {
    renderTable(renamed);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hide Requests' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reorder Region' }));
    await userEvent.keyboard('{ArrowUp}');

    await userEvent.click(screen.getByLabelText('Column options for Region'));
    await userEvent.click(await screen.findByText('Filter values'));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'us-east' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(headers()).toEqual(['Region', 'Customer']);
    expect(rows()).toEqual([
      ['us-east', 'customer-a'],
      ['us-east', 'customer-c'],
    ]);
  });

  it('keeps hidden and reordered columns when every display name changes', async () => {
    const { rerender, set } = renderTable(renamed);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hide Region' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reorder Requests' }));
    await userEvent.keyboard('{ArrowUp}');
    expect(headers()).toEqual(['Customer', 'Requests']);
    set.mockClear();

    rerender(withDisplayNames({ customer_id: 'Client', region_name: 'Area', request_count: 'Hits' }));

    expect(headers()).toEqual(['Client', 'Hits']);
    expect(sidebarOrder()).toEqual(['Reorder Client', 'Reorder Hits', 'Reorder Area']);
    expect(screen.getByRole('checkbox', { name: 'Show Area' })).not.toBeChecked();
    expect(set).not.toHaveBeenCalled();
  });
});
