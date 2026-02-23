import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { Checkbox } from '../Forms/Checkbox';
import { Icon } from '../Icon/Icon';

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

function setup(jsx: React.JSX.Element) {
  render(jsx);
  return {
    user: userEvent.setup(),
  };
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

  it('should correctly sort rows', async () => {
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
    const { user } = setup(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

    const valueColumnHeader = screen.getByRole('columnheader', { name: 'Value' });
    const countryColumnHeader = screen.getByRole('columnheader', { name: 'Country' });
    const valueColumnSortButton = within(valueColumnHeader).getByRole('button');
    const countryColumnSortButton = within(countryColumnHeader).getByRole('button');

    expect(valueColumnHeader).not.toHaveAttribute('aria-sort');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');

    await user.click(countryColumnSortButton);
    expect(valueColumnHeader).not.toHaveAttribute('aria-sort');
    expect(countryColumnHeader).toHaveAttribute('aria-sort', 'ascending');

    await user.click(valueColumnSortButton);
    expect(valueColumnHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');

    await user.click(valueColumnSortButton);
    expect(valueColumnHeader).toHaveAttribute('aria-sort', 'descending');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');

    await user.click(valueColumnSortButton);
    expect(valueColumnHeader).not.toHaveAttribute('aria-sort');
    expect(countryColumnHeader).not.toHaveAttribute('aria-sort');
  });
  describe('row expansion', () => {
    it('correctly expands rows', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      const { user } = setup(
        <InteractiveTable
          columns={columns}
          data={data}
          getRowId={getRowId}
          renderExpandedRow={(row) => <div data-testid={`test-${row.id}`}>{row.country}</div>}
        />
      );

      const expanderButton = screen.getByRole('button', { name: /toggle row expanded/i });
      await user.click(expanderButton);

      expect(screen.getByTestId('test-1')).toHaveTextContent('Sweden');

      expect(expanderButton).toHaveAttribute(
        // ancestor tr's id should match the expander button's aria-controls attribute
        'aria-controls',
        screen.getByTestId('test-1').parentElement?.parentElement?.id
      );
    });
    it('does not render expand all when showExpandAll is false', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      setup(
        <InteractiveTable
          columns={columns}
          data={data}
          getRowId={getRowId}
          renderExpandedRow={(row) => <div data-testid={`test-${row.id}`}>{row.country}</div>}
          showExpandAll={false}
        />
      );

      expect(screen.queryByRole('button', { name: 'Expand all rows' })).not.toBeInTheDocument();
    });
    it('does not render expand all when showExpandAll is not provided', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      setup(
        <InteractiveTable
          columns={columns}
          data={data}
          getRowId={getRowId}
          renderExpandedRow={(row) => <div data-testid={`test-${row.id}`}>{row.country}</div>}
        />
      );

      expect(screen.queryByRole('button', { name: 'Expand all rows' })).not.toBeInTheDocument();
    });
    it('renders expand all when showExpandAll is true', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      setup(
        <InteractiveTable
          columns={columns}
          data={data}
          getRowId={getRowId}
          renderExpandedRow={(row) => <div data-testid={`test-${row.id}`}>{row.country}</div>}
          showExpandAll
        />
      );

      expect(screen.getByRole('button', { name: 'Expand all rows' })).toBeInTheDocument();
    });
    it('expands all rows when expand all is clicked', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [
        { id: '1', value: '1', country: 'Sweden' },
        { id: '2', value: '2', country: 'Belgium' },
        { id: '3', value: '3', country: 'France' },
      ];
      const { user } = setup(
        <InteractiveTable
          columns={columns}
          data={data}
          getRowId={getRowId}
          renderExpandedRow={(row) => <div data-testid={`test-${row.id}`}>{row.country}</div>}
          showExpandAll
        />
      );

      expect(screen.queryByTestId('test-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-3')).not.toBeInTheDocument();

      const expandAllButton = screen.getByRole('button', { name: 'Expand all rows' });
      await user.click(expandAllButton);

      expect(screen.getByTestId('test-1')).toBeInTheDocument();
      expect(screen.getByTestId('test-2')).toBeInTheDocument();
      expect(screen.getByTestId('test-3')).toBeInTheDocument();
    });
  });
  describe('pagination', () => {
    it('does not render pagination controls if pageSize is not set', () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();

      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={0} />);

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    });

    it('renders pagination controls if pageSize is set and more items than page size', () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [
        { id: '1', value: '1', country: 'Sweden' },
        { id: '2', value: '2', country: 'Belgium' },
      ];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={1} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    });

    it('renders contents on second page after navigating to the second page', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }, { id: 'country' }];
      const data: TableData[] = [
        { id: '1', value: '1', country: 'Sweden' },
        { id: '2', value: '2', country: 'Belgium' },
      ];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={1} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2/i })).toBeInTheDocument();

      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /2/i }));

      expect(screen.queryByText('Sweden')).not.toBeInTheDocument();
      expect(screen.getByText('Belgium')).toBeInTheDocument();
    });

    it('does not reset page number after modifying table data', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }, { id: 'country' }];
      const data: TableData[] = [
        { id: '1', value: '1', country: 'Sweden' },
        { id: '2', value: '2', country: 'Belgium' },
      ];
      const { rerender } = render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={1} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2/i })).toBeInTheDocument();

      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /2/i }));

      expect(screen.queryByText('Sweden')).not.toBeInTheDocument();
      expect(screen.getByText('Belgium')).toBeInTheDocument();

      const updatedData = [data[0], { ...data[1], country: 'Belgique' }];
      rerender(<InteractiveTable columns={columns} data={updatedData} getRowId={getRowId} pageSize={1} />);

      expect(screen.queryByText('Sweden')).not.toBeInTheDocument(); // Because we are on the 2nd page
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument(); // Because it was changed to Belgique
      expect(screen.getByText('Belgique')).toBeInTheDocument();
    });

    it('does reset to first page after modifying table data if `autoResetPage` is set', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }, { id: 'country' }];
      const data: TableData[] = [
        { id: '1', value: '1', country: 'Sweden' },
        { id: '2', value: '2', country: 'Belgium' },
      ];
      const { rerender } = render(
        <InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={1} autoResetPage />
      );

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2/i })).toBeInTheDocument();

      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /2/i }));

      expect(screen.queryByText('Sweden')).not.toBeInTheDocument();
      expect(screen.getByText('Belgium')).toBeInTheDocument();

      const updatedData = [data[0], { ...data[1], country: 'Belgique' }];
      rerender(
        <InteractiveTable columns={columns} data={updatedData} getRowId={getRowId} pageSize={1} autoResetPage />
      );

      expect(screen.getByText('Sweden')).toBeInTheDocument(); // Because we are back on the first page
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument(); // Because we should be on the first page now
      expect(screen.queryByText('Belgique')).not.toBeInTheDocument(); // Because we should be on the first page now
    });

    it('when on the last page, and its rows are all deleted, gracefully stay on the same page number even though it is blank', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }, { id: 'country' }];
      const data: TableData[] = [
        { id: '1', value: '1', country: 'Sweden' },
        { id: '2', value: '2', country: 'Belgium' },
        { id: '3', value: '3', country: 'Canada' },
      ];
      const { rerender } = render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={1} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /3/i })).toBeInTheDocument();

      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument();
      expect(screen.queryByText('Canada')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /3/i }));

      expect(screen.queryByText('Sweden')).not.toBeInTheDocument();
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();

      const updatedData = data.slice(0, 2);
      rerender(<InteractiveTable columns={columns} data={updatedData} getRowId={getRowId} pageSize={1} />);

      expect(screen.getByRole('button', { name: /1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /3/i })).not.toBeInTheDocument(); // Because the 3rd page is now empty

      expect(screen.queryByText('Sweden')).not.toBeInTheDocument(); // Because we are still on the 3rd page (even though it is empty)
      expect(screen.queryByText('Belgium')).not.toBeInTheDocument(); // Because we are still on the 3rd page (even though it is empty)
      expect(screen.queryByText('Canada')).not.toBeInTheDocument(); // Because it was deleted
    });

    it('does not render pagination controls if pageSize is set and fewer items than page size', () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} pageSize={10} />);

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    });
  });

  describe('headerTooltip', () => {
    it('does not render tooltips if headerTooltips is not set', () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

      expect(screen.queryByTestId('header-tooltip-icon')).not.toBeInTheDocument();
    });
    it('renders tooltips if headerTooltips is set', () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      const headerTooltips = {
        id: { content: 'this is the id' },
      };
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} headerTooltips={headerTooltips} />);

      expect(screen.getByTestId('header-tooltip-icon')).toBeInTheDocument();
    });
  });

  describe('controlled sort', () => {
    it('should call fetchData with the correct sortBy argument', async () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID', sortType: 'string' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      const fetchData = jest.fn();
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} fetchData={fetchData} />);

      const valueColumnHeader = screen.getByRole('button', {
        name: /id/i,
      });

      await userEvent.click(valueColumnHeader);

      expect(fetchData).toHaveBeenCalledWith({ sortBy: [{ id: 'id', desc: false }] });
    });
  });

  describe('custom header rendering', () => {
    it('should render string headers', () => {
      const columns: Array<Column<TableData>> = [{ id: 'id', header: 'ID' }];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

      expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    });

    it('should render React element headers', () => {
      const columns: Array<Column<TableData>> = [
        {
          id: 'checkbox',
          header: (
            <>
              <label htmlFor="select-all" className="sr-only">
                Select all rows
              </label>
              <Checkbox id="select-all" data-testid="header-checkbox" />
            </>
          ),
          cell: () => <Checkbox data-testid="cell-checkbox" aria-label="Select row" />,
        },
      ];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

      expect(screen.getByTestId('header-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('cell-checkbox')).toBeInTheDocument();
      expect(screen.getByLabelText('Select all rows')).toBeInTheDocument();
      expect(screen.getByLabelText('Select row')).toBeInTheDocument();
      expect(screen.getByText('Select all rows')).toBeInTheDocument();
    });

    it('should render function renderer headers', () => {
      const columns: Array<Column<TableData>> = [
        {
          id: 'firstName',
          header: () => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="user" size="sm" data-testid="header-icon" />
              <span>First Name</span>
            </span>
          ),
          sortType: 'string',
        },
      ];
      const data: TableData[] = [{ id: '1', value: '1', country: 'Sweden' }];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

      expect(screen.getByTestId('header-icon')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /first name/i })).toBeInTheDocument();
    });

    it('should render all header types together', () => {
      const columns: Array<Column<TableData>> = [
        {
          id: 'checkbox',
          header: (
            <>
              <label htmlFor="select-all" className="sr-only">
                Select all rows
              </label>
              <Checkbox id="select-all" data-testid="header-checkbox" />
            </>
          ),
          cell: () => <Checkbox aria-label="Select row" />,
        },
        {
          id: 'id',
          header: () => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="user" size="sm" data-testid="header-icon" />
              <span>ID</span>
            </span>
          ),
          sortType: 'string',
        },
        { id: 'country', header: 'Country', sortType: 'string' },
        { id: 'value', header: 'Value' },
      ];
      const data: TableData[] = [
        { id: '1', value: 'Value 1', country: 'Sweden' },
        { id: '2', value: 'Value 2', country: 'Norway' },
      ];
      render(<InteractiveTable columns={columns} data={data} getRowId={getRowId} />);

      expect(screen.getByTestId('header-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('header-icon')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Country' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument();

      // Verify data is rendered
      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.getByText('Norway')).toBeInTheDocument();
      expect(screen.getByText('Value 1')).toBeInTheDocument();
      expect(screen.getByText('Value 2')).toBeInTheDocument();
    });
  });
});
