import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  type DataLinkPostProcessor,
  DataLinksContext,
  type DataTransformerConfig,
  EventBusSrv,
  FieldType,
  LoadingState,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { TableCellDisplayMode, type TableOptions } from '@grafana/schema';
import { mockClientSize } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { PanelContextProvider } from '@grafana/ui';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { getPanelProps } from '../test-utils';

import { TablePanel } from './TablePanel';
import { plugin } from './module';

const transformations: readonly DataTransformerConfig[] = [];

beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
  standardEditorsRegistry.setInit(getAllOptionEditors);
  standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);
  setPluginImportUtils({
    importPanelPlugin: async () => plugin,
    getPanelPluginFromCache: () => plugin,
  });
});

beforeEach(() => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
});

afterEach(() => setTestFlags({}));

function makeFrame(name = 'Query', refId = 'A', values = [10, 20]) {
  return toDataFrame({ name, refId, fields: [{ name: 'metric', type: FieldType.number, values }] });
}

function panel(sourceSeries: DataFrame[], dataLinkPostProcessor: DataLinkPostProcessor, frameIndex = 0) {
  const fieldConfig = {
    defaults: {
      custom: { cellOptions: { type: TableCellDisplayMode.DataLinks } },
      links: [{ title: 'Inspect', url: '/fallback' }],
    },
    overrides: [],
  };
  const props = getPanelProps<TableOptions>(
    { showHeader: true, frameIndex },
    { fieldConfig, width: 800, replaceVariables: (value) => value }
  );
  props.data = {
    state: LoadingState.Done,
    timeRange: props.timeRange,
    series: applyFieldOverrides({
      data: sourceSeries,
      fieldConfig,
      fieldConfigRegistry: plugin.fieldConfigRegistry,
      theme: createTheme(),
      replaceVariables: props.replaceVariables,
      timeZone: props.timeZone,
      dataLinkPostProcessor,
    }),
  };

  return (
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <DataLinksContext.Provider value={{ dataLinkPostProcessor }}>
        <PanelContextProvider
          value={{
            eventsScope: 'table',
            eventBus: new EventBusSrv(),
            adHocTransformations: {
              get: () => transformations,
              set: () => {},
              getSourceSeries: () => sourceSeries,
              subscribe: () => () => {},
            },
          }}
        >
          <TablePanel {...props} />
        </PanelContextProvider>
      </DataLinksContext.Provider>
    </OpenFeatureProvider>
  );
}

it('rebuilds row links with the current data-link processor', async () => {
  const sourceSeries = [makeFrame()];
  const processor: DataLinkPostProcessor = ({ linkModel, field, config }) => ({
    ...linkModel,
    href: `/dashboard/${field.values[config.valueRowIndex!]}`,
  });
  const { rerender } = render(panel(sourceSeries, processor));

  expect((await screen.findAllByRole('link', { name: 'Inspect' })).map((link) => link.getAttribute('href'))).toEqual([
    '/dashboard/10',
    '/dashboard/20',
  ]);

  rerender(panel(sourceSeries, ({ linkModel }) => ({ ...linkModel, href: '/correlation' })));
  expect((await screen.findAllByRole('link', { name: 'Inspect' })).map((link) => link.getAttribute('href'))).toEqual([
    '/correlation',
    '/correlation',
  ]);
});

it('preserves multi-frame display names and series indices when rebuilding the selected frame', async () => {
  const sourceSeries = [makeFrame('First', 'A', [10]), makeFrame('Second', 'B', [20])];
  render(
    panel(sourceSeries, ({ linkModel, field }) => ({ ...linkModel, href: `/series/${field.state?.seriesIndex}` }), 1)
  );

  expect(await screen.findByRole('columnheader', { name: /Second metric/ })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Inspect' })).toHaveAttribute('href', '/series/1');
});

it('rebuilds selected-frame context when only a sibling frame changes', async () => {
  const selected = makeFrame('Second', 'B', [20]);
  const processor: DataLinkPostProcessor = ({ linkModel, field }) => ({
    ...linkModel,
    href: `/series/${field.state?.seriesIndex}`,
  });
  const { rerender } = render(panel([makeFrame('First', 'A', [10]), selected], processor, 1));
  expect(await screen.findByRole('columnheader', { name: /Second metric/ })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Inspect' })).toHaveAttribute('href', '/series/1');

  const sibling = toDataFrame({
    name: 'Second',
    refId: 'A',
    fields: [
      { name: 'metric', type: FieldType.number, values: [10] },
      { name: 'extra', type: FieldType.number, values: [30] },
    ],
  });
  rerender(panel([sibling, selected], processor, 1));

  expect(await screen.findByRole('columnheader', { name: /^metric/ })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Inspect' })).toHaveAttribute('href', '/series/2');
});
