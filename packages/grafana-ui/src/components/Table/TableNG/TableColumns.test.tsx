import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { applyFieldOverrides, createDataFrame, createTheme, FieldType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';
import { mockClientSize } from '@grafana/test-utils';

import { TableNG } from './TableNG';

beforeAll(() => mockClientSize({ width: 800, height: 600 }));

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
