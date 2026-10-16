import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InteractiveTable } from './InteractiveTableLazy';
import { type Column } from './types';

interface TableData {
  id: string;
  country: string;
}

it('uses the latest rows and preserves sorting and expansion through the lazy boundary', async () => {
  const user = userEvent.setup();
  const columns: Array<Column<TableData>> = [{ id: 'country', header: 'Country', sortType: 'string' }];
  const props = {
    columns,
    getRowId: (row: TableData) => row.id,
    renderExpandedRow: (row: TableData) => <div>Details: {row.country}</div>,
    showExpandAll: true,
  };
  const { rerender } = render(<InteractiveTable {...props} data={[{ id: '1', country: 'Sweden' }]} />);
  rerender(<InteractiveTable {...props} data={[{ id: '1', country: 'Belgium' }]} />);

  expect(await screen.findByRole('cell', { name: 'Belgium' })).toBeInTheDocument();
  expect(screen.queryByText('Sweden')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Sort column Country' }));
  expect(screen.getByRole('columnheader', { name: 'Country' })).toHaveAttribute('aria-sort', 'ascending');

  await user.click(screen.getByRole('button', { name: 'Expand all rows' }));
  expect(screen.getByText('Details: Belgium')).toBeInTheDocument();

  rerender(<InteractiveTable {...props} data={[{ id: '1', country: 'France' }]} />);
  expect(screen.getByText('Details: France')).toBeInTheDocument();
});
