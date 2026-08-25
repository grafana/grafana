import { render } from 'test/test-utils';

import { type DataFrame, EventBusSrv, FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { type DataTransformerConfig, TableCellHeight, type TableOptions } from '@grafana/schema';
import { type PanelContext, PanelContextProvider } from '@grafana/ui';
import { TableNG } from '@grafana/ui/unstable';

import { getPanelProps } from '../test-utils';

import { TablePanel } from './TablePanel';

// The panel's own job is deciding whether to offer the reorder affordance and turning a dropped
// order into a transformation. What the grid does with the props is TableNG's own suite.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  TableNG: jest.fn(() => null),
}));

const tableNg = jest.mocked(TableNG);

const options: TableOptions = { frameIndex: 0, showHeader: true, cellHeight: TableCellHeight.Sm };

const frame = (): DataFrame =>
  toDataFrame({
    name: 'logs',
    fields: [
      { name: 'time', type: FieldType.time, values: [1000] },
      { name: 'level', type: FieldType.string, values: ['info'] },
      { name: 'msg', type: FieldType.string, values: ['hello'] },
    ],
  });

/** Renders the panel and returns the props it handed the table. */
function renderPanel(context: Partial<PanelContext> = {}) {
  const props = getPanelProps(options, {
    data: { state: LoadingState.Done, series: [frame()], timeRange: getDefaultTimeRange() },
    fieldConfig: { defaults: {}, overrides: [] },
    width: 800,
    height: 600,
  });

  render(
    <PanelContextProvider value={{ eventsScope: 'global', eventBus: new EventBusSrv(), ...context }}>
      <TablePanel {...props} />
    </PanelContextProvider>
  );

  return tableNg.mock.calls[0][0];
}

describe('TablePanel column reordering', () => {
  beforeEach(() => {
    tableNg.mockClear();
  });

  it.each([
    { desc: 'the host offers neither member', context: {} },
    { desc: 'the read is offered without the write', context: { transformations: [] } },
    { desc: 'the write is offered without the read', context: { onTransformationsChange: jest.fn() } },
  ])('passes no reorder callback when $desc, which takes the drag handles away', ({ context }) => {
    expect(renderPanel(context).onColumnReorder).toBeUndefined();
  });

  it('turns a dropped order into an organize transformation', () => {
    const onTransformationsChange = jest.fn();
    const { onColumnReorder } = renderPanel({ transformations: [], onTransformationsChange });

    onColumnReorder?.(['msg', 'time', 'level']);

    expect(onTransformationsChange).toHaveBeenCalledTimes(1);
    expect(onTransformationsChange).toHaveBeenCalledWith([
      {
        id: 'organize',
        options: {
          indexByName: { msg: 0, time: 1, level: 2 },
          excludeByName: {},
          renameByName: {},
          includeByName: {},
        },
      },
    ]);
  });

  it("derives the write from the panel's current transformations, so a second drag updates the first", () => {
    const onTransformationsChange = jest.fn();
    const previous: DataTransformerConfig = {
      id: 'organize',
      options: { indexByName: { msg: 0, time: 1, level: 2 }, excludeByName: {}, renameByName: {} },
    };
    const { onColumnReorder } = renderPanel({ transformations: [previous], onTransformationsChange });

    onColumnReorder?.(['level', 'msg', 'time']);

    expect(onTransformationsChange).toHaveBeenCalledWith([
      { ...previous, options: { ...previous.options, indexByName: { level: 0, msg: 1, time: 2 } } },
    ]);
  });
});
