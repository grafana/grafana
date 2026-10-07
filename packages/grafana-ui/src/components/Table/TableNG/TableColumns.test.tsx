import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { applyFieldOverrides, createDataFrame, createTheme, FieldType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';
import { mockBoundingClientRect, mockClientSize } from '@grafana/test-utils';

import { TableNG } from './TableNG';

beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
  mockBoundingClientRect({ width: 800, height: 600 });
});

it('sizes the grid from the clamped sidebar width when the panel shrinks, grows, and is dragged', async () => {
  const data = createDataFrame({
    fields: [
      {
        name: 'A',
        type: FieldType.string,
        values: ['value'],
        config: { custom: { hideable: true, minWidth: 50 } },
        display: () => ({ text: 'value', numeric: NaN }),
      },
    ],
  });
  const table = (width: number) => (
    <TableNG data={data} width={width} height={400} tableRefreshEnabled noPanelPadding showColumnsSidebar />
  );
  const { rerender } = render(table(800));
  expect(screen.getByRole('grid')).toHaveStyle({ gridTemplateColumns: '571px' });

  rerender(table(200));
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '50');
  expect(screen.getByRole('grid')).toHaveStyle({ gridTemplateColumns: '95px' });

  rerender(table(800));
  expect(screen.getByRole('grid')).toHaveStyle({ gridTemplateColumns: '571px' });

  const pane = screen.getByRole('group', { name: 'Column visibility' }).parentElement!;
  const rect = pane.getBoundingClientRect();
  let paneWidth = 220;
  // useSplitter measures its CSS limits by temporarily collapsing and expanding the pane.
  const paneRect = jest.spyOn(pane, 'getBoundingClientRect').mockImplementation(() => ({
    ...rect,
    width:
      pane.style.flexGrow === '0' ? 0 : pane.style.flexGrow === '100' ? parseFloat(pane.style.maxWidth) : paneWidth,
  }));
  const splitter = screen.getByRole('separator');
  splitter.setPointerCapture = jest.fn();
  splitter.releasePointerCapture = jest.fn();
  const user = userEvent.setup();
  await user.pointer([
    { keys: '[MouseLeft>]', target: splitter, coords: { clientX: 0, clientY: 0 } },
    { target: splitter, coords: { clientX: 300, clientY: 0 } },
  ]);
  expect(pane).toHaveStyle({ maxWidth: '396px' });
  expect(screen.getByRole('grid')).toHaveStyle({ gridTemplateColumns: '395px' });

  paneWidth = 396;
  await user.pointer({ keys: '[/MouseLeft]', target: splitter });
  expect(screen.getByRole('grid')).toHaveStyle({ gridTemplateColumns: '395px' });
  paneRect.mockRestore();
});

it('reuses wrapped-cell measurements during unrelated renders with hidden columns', () => {
  const display = jest.fn(() => ({ text: 'A wrapped value', numeric: NaN }));
  const data = createDataFrame({
    fields: [
      {
        name: 'A',
        type: FieldType.number,
        values: [1],
        display,
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Auto } } },
      },
      { name: 'B', type: FieldType.string, values: ['hidden'], config: {} },
    ],
  });
  const props = {
    data,
    width: 800,
    height: 400,
    hiddenColumns: new Set(['B']),
    onHiddenColumnsChange: jest.fn(),
  };
  const baselineDisplay = jest.fn(() => ({ text: 'A wrapped value', numeric: NaN }));
  const baselineData = createDataFrame({ fields: [{ ...data.fields[0], display: baselineDisplay }] });
  const tables = (transparent = false) => (
    <>
      <TableNG {...props} transparent={transparent} />
      <TableNG data={baselineData} width={800} height={400} transparent={transparent} />
    </>
  );
  const { rerender } = render(tables());
  expect(display).toHaveBeenCalled();
  display.mockClear();
  baselineDisplay.mockClear();

  rerender(tables(true));

  expect(screen.getAllByRole('gridcell', { name: 'A wrapped value' })).toHaveLength(2);
  // Both cells redraw; hidden columns must not add extra formatting for sizing.
  expect(display).toHaveBeenCalledTimes(baselineDisplay.mock.calls.length);
});

it('does not wrap JSON display processors again when filtering hidden columns', () => {
  const data = createDataFrame({
    fields: [
      {
        name: 'Temperature',
        type: FieldType.number,
        values: [118.7],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.JSONView } } },
        display: () => ({ text: '118.7', numeric: 118.7, suffix: ' °' }),
      },
      {
        name: 'Hidden',
        type: FieldType.string,
        values: ['hidden value'],
        config: { custom: { hideable: true } },
      },
    ],
  });

  render(
    <TableNG
      data={data}
      width={800}
      height={400}
      hiddenColumns={new Set(['Hidden'])}
      onHiddenColumnsChange={jest.fn()}
    />
  );

  // JSON cells already append the suffix twice; column visibility must not add another copy.
  expect(screen.getByRole('gridcell', { name: '118.7 ° °' })).toBeVisible();
  expect(screen.queryByRole('columnheader', { name: 'Hidden' })).not.toBeInTheDocument();
});

it('keeps restore controls when the only hideable column is absent from transformed data', async () => {
  const data = createDataFrame({
    fields: [
      {
        name: 'A',
        type: FieldType.string,
        values: ['visible'],
        config: { custom: { hideable: false } },
        display: () => ({ text: 'visible', numeric: NaN }),
      },
    ],
  });
  const onHiddenColumnsChange = jest.fn();
  const table = (hiddenColumns: ReadonlySet<string>, frame = data) => (
    <TableNG
      data={frame}
      width={800}
      height={400}
      tableRefreshEnabled
      showColumnsSidebar
      columnCatalog={['A', 'B']}
      hiddenColumns={hiddenColumns}
      onHiddenColumnsChange={onHiddenColumnsChange}
    />
  );
  const { rerender } = render(table(new Set(['B'])));
  const sidebar = screen.getByRole('group', { name: 'Column visibility' });

  await userEvent.click(screen.getByRole('checkbox', { name: 'Show B' }));

  expect(onHiddenColumnsChange).toHaveBeenCalledWith(new Set());

  // Controlled visibility updates before the transformed data includes B again.
  rerender(table(new Set()));
  expect(screen.getByRole('group', { name: 'Column visibility' })).toBe(sidebar);
  expect(screen.getByRole('checkbox', { name: 'Hide B' })).toBeChecked();
  expect(screen.queryByRole('columnheader', { name: 'B' })).not.toBeInTheDocument();

  onHiddenColumnsChange.mockClear();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Hide B' }));
  expect(onHiddenColumnsChange).toHaveBeenCalledWith(new Set(['B']));

  await userEvent.click(screen.getByRole('button', { name: 'Close column visibility panel' }));
  await userEvent.click(screen.getByRole('button', { name: 'Column options for A' }));
  await userEvent.click(await screen.findByText('Manage columns'));
  expect(within(screen.getByRole('group', { name: 'Column visibility' })).getByText('B')).toBeVisible();

  const restored = createDataFrame({
    fields: [
      ...data.fields,
      {
        name: 'B',
        type: FieldType.string,
        values: ['restored'],
        config: { custom: { hideable: true } },
        display: () => ({ text: 'restored', numeric: NaN }),
      },
    ],
  });
  rerender(table(new Set(), restored));
  expect(screen.getByRole('gridcell', { name: 'restored' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Hide B' })).toBeChecked();
});

function Harness({ revision = 0 }: { revision?: number }) {
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(new Set());
  const source = createDataFrame({
    fields: ['A', 'B', 'C'].map((name) => ({
      name,
      type: FieldType.string,
      values: [`${name}${revision}`],
      config: { custom: { hideable: true } },
    })),
  });
  const data = applyFieldOverrides({
    data: [source],
    fieldConfig: { defaults: {}, overrides: [] },
    theme: createTheme(),
    timeZone: 'utc',
    replaceVariables: (value) => value,
  })[0];
  return (
    <TableNG
      data={data}
      width={800}
      height={400}
      tableRefreshEnabled
      showColumnsSidebar
      hiddenColumns={hiddenColumns}
      onHiddenColumnsChange={setHiddenColumns}
      columnCatalog={['A', 'B', 'C']}
      structureRev={revision}
    />
  );
}

it('restores hidden source columns after refresh and protects the last visible column', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Harness />);
  await user.click(screen.getByRole('checkbox', { name: 'Hide A' }));
  await user.click(screen.getByRole('checkbox', { name: 'Hide B' }));
  expect(screen.getByRole('checkbox', { name: 'Hide C' })).toBeDisabled();
  expect(screen.getByRole('gridcell', { name: 'C0' })).toBeVisible();
  expect(screen.queryByRole('gridcell', { name: 'A0' })).not.toBeInTheDocument();

  rerender(<Harness revision={1} />);
  expect(screen.getByRole('gridcell', { name: 'C1' })).toBeVisible();
  await user.click(screen.getByRole('checkbox', { name: 'Show A' }));
  expect(screen.getByRole('gridcell', { name: 'A1' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Show B' })).not.toBeChecked();

  await user.click(screen.getByRole('button', { name: 'Close column visibility panel' }));
  await user.click(screen.getByRole('button', { name: 'Column options for A' }));
  await user.click(await screen.findByText('Manage columns'));
  expect(within(screen.getByRole('group', { name: 'Column visibility' })).getByText('B')).toBeVisible();
});
