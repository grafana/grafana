import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { applyFieldOverrides, createDataFrame, createTheme, FieldType } from '@grafana/data';
import { mockClientSize } from '@grafana/test-utils';

import { TableNG } from './TableNG';

beforeAll(() => mockClientSize({ width: 800, height: 600 }));

function Harness({ revision = 0 }: { revision?: number }) {
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(new Set());
  const source = createDataFrame({
    fields: ['A', 'B', 'C'].map((name) => ({
      name,
      type: FieldType.string,
      values: [`${name}${revision}`],
      config: { custom: { hideable: true, reorderable: true } },
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
