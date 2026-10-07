import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import { PanelContextProvider, type PanelRuntimeTransformations } from '@grafana/ui';
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

function panel(
  sourceSeries: DataFrame[],
  dataLinkPostProcessor: DataLinkPostProcessor,
  frameIndex = 0,
  outputSeries = sourceSeries,
  setTransformations: PanelRuntimeTransformations['set'] = () => {}
) {
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
      data: outputSeries,
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
              set: setTransformations,
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

it.each(['removed', 'reordered'])('displays the selected source when output frames are %s', async (change) => {
  const sourceSeries = [makeFrame('First', 'A', [10]), makeFrame('Second', 'B', [20])];
  const outputSeries = change === 'removed' ? [sourceSeries[1]] : [sourceSeries[1], sourceSeries[0]];
  render(
    panel(
      sourceSeries,
      ({ linkModel, field, config }) => ({
        ...linkModel,
        href: `/series/${field.state?.seriesIndex}/row/${field.values[config.valueRowIndex!]}`,
      }),
      0,
      outputSeries
    )
  );

  expect(await screen.findByRole('columnheader', { name: /Second metric/ })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Inspect' })).toHaveAttribute('href', '/series/1/row/20');
});

it.each(['missing', 'ambiguous'])('keeps the output frame when the source match is %s', async (match) => {
  const sourceSeries = [makeFrame('First', 'A', [10]), makeFrame('Second', match === 'ambiguous' ? 'A' : 'B', [20])];
  const outputSeries = [makeFrame('Output', match === 'ambiguous' ? 'A' : 'C', [99])];
  render(
    panel(
      sourceSeries,
      ({ linkModel, field, config }) => ({ ...linkModel, href: `/row/${field.values[config.valueRowIndex!]}` }),
      0,
      outputSeries
    )
  );

  expect(await screen.findByRole('link', { name: 'Inspect' })).toHaveAttribute('href', '/row/99');
});

it('writes row filters with the matched source index and scope', async () => {
  const sourceSeries = ['A', 'B'].map((refId) =>
    toDataFrame({
      name: refId,
      refId,
      fields: [{ name: 'label', type: FieldType.string, values: [`${refId}-one`, `${refId}-two`] }],
    })
  );
  const set = jest.fn();
  render(panel(sourceSeries, ({ linkModel }) => linkModel, 0, [sourceSeries[1]], set));
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Column options for B label'));
  await user.click(await screen.findByText('Filter values'));
  await user.click(screen.getByRole('checkbox', { name: 'B-one' }));
  await user.click(screen.getByRole('button', { name: 'Ok' }));

  expect(set).toHaveBeenCalledWith('grafana:table-view', [
    expect.objectContaining({
      id: 'filterByValue',
      options: expect.objectContaining({
        target: { refId: 'B', frameIndex: 1, frameKey: '["B",1,1]', parentIndex: undefined, parentKey: undefined },
      }),
    }),
  ]);
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
