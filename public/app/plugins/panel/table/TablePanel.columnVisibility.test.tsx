import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen, waitFor } from '@testing-library/react';
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
import { mockClientSize } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { PanelContextProvider } from '@grafana/ui';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { getPanelProps } from '../test-utils';

import { TablePanel } from './TablePanel';
import { plugin } from './module';

beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
  standardEditorsRegistry.setInit(getAllOptionEditors);
  standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);
  setPluginImportUtils({
    importPanelPlugin: async () => plugin,
    getPanelPluginFromCache: () => plugin,
  });
});

beforeEach(() => setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true }));
afterEach(() => setTestFlags({}));

it('does not show ad hoc column controls in panel edit mode', () => {
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

  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['A', 'B']);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /manage columns/i })).not.toBeInTheDocument();
  expect(set).not.toHaveBeenCalled();
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
  expect(screen.getByRole('checkbox', { name: 'Show B' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hide C' })).toBeDisabled();
  expect(screen.queryByRole('checkbox', { name: / A$/ })).not.toBeInTheDocument();
  expect(set).not.toHaveBeenCalled();

  rerender(table(false));
  expect(screen.getByRole('checkbox', { name: 'Hide A' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hide C' })).toBeEnabled();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Show B' }));
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
  expect(transformations[0].options).toEqual({ indexByName: {}, excludeByName: { B: true }, renameByName: {} });
  expect(screen.getByRole('checkbox', { name: 'Show B' })).not.toBeChecked();
  expect(set).toHaveBeenCalledTimes(1);
});
