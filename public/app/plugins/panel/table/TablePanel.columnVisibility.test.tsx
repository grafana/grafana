import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  EventBusSrv,
  FieldType,
  LoadingState,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
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
      { showHeader: true, showColumnsSidebar: true },
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
