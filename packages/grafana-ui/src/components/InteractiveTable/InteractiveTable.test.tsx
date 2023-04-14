import { fireEvent, getByRole, render, screen } from '@testing-library/react';
import React from 'react';

import { InteractiveTable } from './InteractiveTable';
import { Column } from './types';

interface TableData {
  id: string;
  country?: string;
  value?: string;
}
function getRowId(row: TableData) {
  return row.id;
}

describe('InteractiveTable', () => {
  it('should not render hidden columns', () => {
    const columns: Array<Column<TableData>> = [
      { id: 'id', header: 'ID' },
      { id: 'country', header: 'Country', visible: () => false },
    ];
    const data: TableData[] = [
      { id: '1', country: 'Sweden' },
      { id: '2', country: 'Portugal' },
    ];
    render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Country' })).not.toBeInTheDocument();
  });

  it('should correctly sort rows', () => {
    // We are not testing the sorting logic here since it is already tested in react-table,
    // but instead we are testing that the sorting is applied correctly to the table and correct aria attributes are set
    // according to https://www.w3.org/WAI/ARIA/apg/example-index/table/sortable-table
    const columns: Array<Column<TableData>> = [
      { id: 'id', header: 'ID' },
      { id: 'value', header: 'Value', sortType: 'string' },
      { id: 'country', header: 'Country', sortType: 'number' },
    ];
    const data: TableData[] = [
      { id: '1', value: '1', country: 'Sweden' },
      { id: '2', value: '3', country: 'Portugal' },
      { id: '3', value: '2', country: 'Italy' },
    ];
    render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

    const valueColumnHeader = screen.getByRole('columnheader', { name: 'Value' });
    const countryColumnHeader = screen.getByRole('columnheader', { name: 'Country' });
    const valueColumnSortButton = getByRole(valueColumnHeader, 'button');
    const countryColumnSortButton = getByRole(countryColumnHeader, 'button');

    expect(valueColumnHeader).not.toHaveAttribute('aria-sort');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');

    fireEvent.click(countryColumnSortButton);
    expect(valueColumnHeader).not.toHaveAttribute('aria-sort');
    expect(countryColumnHeader).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(valueColumnSortButton);
    expect(valueColumnHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');

    fireEvent.click(valueColumnSortButton);
    expect(valueColumnHeader).toHaveAttribute('aria-sort', 'descending');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');

    fireEvent.click(valueColumnSortButton);
    expect(valueColumnHeader).not.toHaveAttribute('aria-sort');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');
  });

  it('correctly expands rows', () => {
    const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
    const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
    render(
      <InteractiveTable
        columns={columns}
        data={data}
        getRowId={getRowId}
        renderExpandedRow={(row) => <div data-testid={`test-${row.id}`}>{row.country}</div>}
      />
    );

    const expanderButton = screen.getByRole('button', { name: /toggle row expanded/i });
    fireEvent.click(expanderButton);

    expect(screen.getByTestId('test-1')).toHaveTextContent('Sweden');

    expect(expanderButton.getAttribute('aria-controls')).toBe(
      // anchestor tr's id should match the expander button's aria-controls attribute
      screen.getByTestId('test-1').parentElement?.parentElement?.id
    );
  });
});
