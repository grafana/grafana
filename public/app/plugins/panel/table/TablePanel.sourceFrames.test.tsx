import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  CoreApp,
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
  setTransformations: PanelRuntimeTransformations['set'] = () => {},
  app = CoreApp.Dashboard,
  savedFilterable = false,
  activeTransformations: readonly DataTransformerConfig[] = transformations
) {
  const fieldConfig = {
    defaults: {
      custom: {
        cellOptions: { type: TableCellDisplayMode.DataLinks },
        ...(savedFilterable ? { filterable: true } : {}),
      },
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
            app,
            eventsScope: 'table',
            eventBus: new EventBusSrv(),
            adHocTransformations: {
              get: () => activeTransformations,
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

it('filters rows locally in panel edit without changing saved transformations', async () => {
  const sourceSeries = [makeFrame()];
  const set = jest.fn();
  render(panel(sourceSeries, ({ linkModel }) => linkModel, 0, sourceSeries, set, CoreApp.PanelEditor));

  await userEvent.click(screen.getByLabelText('Column options for metric'));
  await userEvent.click(await screen.findByText('Filter values'));
  await userEvent.click(screen.getByRole('checkbox', { name: '10' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ok' }));

  expect(screen.getAllByRole('link', { name: 'Inspect' })).toHaveLength(1);
  expect(set).not.toHaveBeenCalled();
});

it('keeps local filters when a frame gains a column with the new-features flag off', async () => {
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: false });
  const original = makeFrame('CSV');
  original.fields[0].config.custom = { filterable: true };
  const renderPanel = (series: DataFrame[]) =>
    panel(
      series,
      ({ linkModel }) => linkModel,
      0,
      series,
      () => {},
      CoreApp.Dashboard,
      true
    );
  const { rerender } = render(renderPanel([original]));

  await userEvent.click(screen.getByRole('button', { name: 'Column options for metric' }));
  await userEvent.click(await screen.findByText('Filter values'));
  await userEvent.click(screen.getByRole('checkbox', { name: '10' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ok' }));
  expect(screen.getAllByRole('link', { name: 'Inspect' })).toHaveLength(1);

  const changed = toDataFrame({
    name: 'Raw',
    refId: 'A',
    fields: [
      { name: 'metric', type: FieldType.number, values: [10, 20], config: { custom: { filterable: true } } },
      { name: 'region', type: FieldType.string, values: ['eu', 'us'] },
    ],
  });
  rerender(renderPanel([changed]));

  expect(screen.getAllByRole('row')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Column options for metric' }));
  expect(await screen.findByText('Update filter')).toBeInTheDocument();
});

it('keeps an applied filter visible and clearable when a query gains a second frame with the same refId', async () => {
  const first = toDataFrame({
    name: 'First',
    refId: 'A',
    fields: [{ name: 'host', type: FieldType.string, values: ['web-1', 'web-2'] }],
  });
  const second = toDataFrame({
    name: 'Second',
    refId: 'A',
    fields: [{ name: 'host', type: FieldType.string, values: ['db-1', 'db-2'] }],
  });
  const set = jest.fn();
  const { rerender } = render(panel([first], ({ linkModel }) => linkModel, 0, [first], set));

  await userEvent.click(screen.getByLabelText('Column options for host'));
  await userEvent.click(await screen.findByText('Filter values'));
  await userEvent.click(screen.getByRole('checkbox', { name: 'web-1' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ok' }));
  const active = set.mock.lastCall?.[1] as readonly DataTransformerConfig[];
  expect(active).toHaveLength(1);

  const filteredFirst = toDataFrame({
    name: 'First',
    refId: 'A',
    fields: [{ name: 'host', type: FieldType.string, values: ['web-1'] }],
  });
  rerender(
    panel(
      [first, second],
      ({ linkModel }) => linkModel,
      0,
      [filteredFirst, second],
      set,
      CoreApp.Dashboard,
      false,
      active
    )
  );

  expect(screen.getAllByRole('row')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: /Edit filter on .*host/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
  expect(set).toHaveBeenLastCalledWith('grafana:table-view', []);

  rerender(panel([first, second], ({ linkModel }) => linkModel, 0, [first, second], set));
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.queryByRole('button', { name: /Edit filter on .*host/ })).not.toBeInTheDocument();
});

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

it.each(['missing', 'ambiguous'])('keeps row filters local when the source match is %s', async (match) => {
  const sourceSeries = [makeFrame('First', 'A'), makeFrame('Second', match === 'ambiguous' ? 'A' : 'B')];
  const outputSeries = [
    toDataFrame({
      name: 'Output',
      refId: match === 'ambiguous' ? 'A' : 'C',
      fields: [{ name: 'label', type: FieldType.string, values: ['keep', 'remove'] }],
    }),
  ];
  const set = jest.fn();
  render(
    panel(
      sourceSeries,
      ({ linkModel, field, config }) => ({ ...linkModel, href: `/row/${field.values[config.valueRowIndex!]}` }),
      0,
      outputSeries,
      set
    )
  );
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Column options for label'));
  await user.click(await screen.findByText('Filter values'));
  await user.click(screen.getByRole('checkbox', { name: 'keep' }));
  await user.click(screen.getByRole('button', { name: 'Ok' }));

  expect((await screen.findAllByRole('link', { name: 'Inspect' })).map((link) => link.getAttribute('href'))).toEqual([
    '/row/keep',
  ]);
  expect(set).not.toHaveBeenCalled();
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
        target: {
          refId: 'B',
          frameIndex: 1,
          frameKey: '["B",1]',
          parentIndex: undefined,
          parentKey: undefined,
        },
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
