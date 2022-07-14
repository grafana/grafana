import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useRowSelect, useTable, Column } from 'react-table';

import { IndeterminateCheckbox, useCheckboxes } from './IndeterminateCheckbox';

type FakeData = {
  age: number;
  firstName: string;
  subRows: number | undefined;
  visits: number;
};

describe('IndeterminateCheckbox', () => {
  it('displays the checkbox', () => {
    render(<IndeterminateCheckbox />);
    const checkbox = screen.getByRole('checkbox');

    expect(checkbox).toBeInTheDocument();
  });
});

describe('IndeterminateCheckbox', () => {
  beforeEach(() => {
    const columns = () => [
      {
        Header: 'First Name',
        accessor: 'firstName',
      },
      {
        Header: 'Age',
        accessor: 'age',
      },
      {
        Header: 'Visits',
        accessor: 'visits',
      },
    ];
    const data = () => makeData(5);
    render(<ReactTable columns={columns()} data={data()} />);
  });
  it('toggles between indeterminate and not-indeterminate if 1 or more non-select-all checkboxes, but not all, are checked', () => {
    const checkbox = screen.getAllByRole('checkbox') as HTMLInputElement[];

    // 1 or more non-select-all checkboxes in table are checked
    fireEvent.click(checkbox[1]);

    expect(checkbox[1].checked).toBe(true);
    expect(screen.getByTestId('indeterminate')).toBeInTheDocument();

    // same box is checked again
    fireEvent.click(checkbox[1]);
    expect(checkbox[1].checked).toBe(false);
    expect(screen.queryByTestId('indeterminate')).not.toBeInTheDocument();
  });

  it('toggles between checked and unchecked if select-all checkbox is clicked directly', () => {
    const checkbox = screen.getAllByRole('checkbox') as HTMLInputElement[];

    // select-all checkbox is clicked directly
    fireEvent.click(checkbox[0]);

    expect(checkbox[0].checked).toBe(true);
    expect(screen.queryByTestId('indeterminate')).not.toBeInTheDocument();

    // select-all checkbox is clicked directly again to toggle checked
    fireEvent.click(checkbox[0]);
    expect(checkbox[0].checked).toBe(false);
  });

  it('toggles between indeterminate and checked if, first, not all and then all non-select-all checkboxes are checked, without select-all being clicked directly', () => {
    const checkbox = screen.getAllByRole('checkbox') as HTMLInputElement[];

    fireEvent.click(checkbox[1]);
    fireEvent.click(checkbox[2]);
    fireEvent.click(checkbox[3]);
    fireEvent.click(checkbox[4]);

    expect(checkbox[0].checked).toBe(false);
    expect(screen.queryByTestId('indeterminate')).toBeInTheDocument();

    // last item is selected, so then indeterminate should switch to checked
    fireEvent.click(checkbox[5]);
    expect(checkbox[0].checked).toBe(true);
    expect(screen.queryByTestId('indeterminate')).not.toBeInTheDocument();
  });
});

// React Table comopnent, to demonstrate functionality only
export function ReactTable({ columns, data }: { columns: Column[]; data: FakeData[] }) {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    {
      columns,
      data,
    },
    useRowSelect,
    useCheckboxes
  );

  return (
    <table {...getTableProps()} style={{ width: '300px', height: '150px' }}>
      <thead>
        {headerGroups.map((headerGroup, headerIndex) => (
          <tr {...headerGroup.getHeaderGroupProps()} key={headerIndex}>
            {headerGroup.headers.map((column, columnIndex) => (
              <th {...column.getHeaderProps()} key={columnIndex}>
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, rowIndex) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()} key={rowIndex}>
              {row.cells.map((cell, cellIndex) => {
                return (
                  <td {...cell.getCellProps()} key={cellIndex}>
                    {cell.render('Cell')}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Helper methods for fake data
const range = (len: number) => {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};

const newPerson = (counter: number) => {
  return {
    firstName: `YourGrace${counter}`,
    age: Math.floor(Math.random() * 30),
    visits: Math.floor(Math.random() * 100),
  };
};

export const makeData = (...lens: number[]) => {
  const depth = 0;
  const len = lens[depth];
  let count = 0;

  return range(len).map((d) => {
    return {
      ...newPerson((count += 1)),
      subRows: lens[depth + 1] ? depth + 1 : undefined,
    };
  });
};
