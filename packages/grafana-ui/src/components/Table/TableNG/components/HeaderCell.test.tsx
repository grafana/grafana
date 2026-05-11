import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Column } from 'react-data-grid';

import { FieldType, type Field } from '@grafana/data';

import { type FilterType, type TableRow, type TableSummaryRow } from '../types';

import { HeaderCell } from './HeaderCell';

const column: Column<TableRow, TableSummaryRow> = {
  key: 'Column A',
  name: 'Column A',
};

const field: Field = {
  name: 'Column A',
  type: FieldType.string,
  config: { custom: { filterable: false } },
  values: [],
};

const filter: FilterType = {};

describe('HeaderCell', () => {
  it('only renders the column actions menu when onAddTransformation is provided', () => {
    const { rerender } = render(
      <HeaderCell
        column={column}
        rows={[]}
        field={field}
        filter={filter}
        setFilter={jest.fn()}
        selectFirstCell={jest.fn()}
        crossFilterRows={{}}
        crossFilterTailRows={[]}
      />
    );

    expect(screen.queryByRole('button', { name: 'Column actions' })).not.toBeInTheDocument();

    rerender(
      <HeaderCell
        column={column}
        rows={[]}
        field={field}
        filter={filter}
        setFilter={jest.fn()}
        selectFirstCell={jest.fn()}
        crossFilterRows={{}}
        crossFilterTailRows={[]}
        onAddTransformation={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Column actions' })).toBeInTheDocument();
  });

  it('calls onAddTransformation with organize.excludeByName when Hide column is selected', async () => {
    const onAddTransformation = jest.fn();

    render(
      <HeaderCell
        column={column}
        rows={[]}
        field={field}
        filter={filter}
        setFilter={jest.fn()}
        selectFirstCell={jest.fn()}
        crossFilterRows={{}}
        crossFilterTailRows={[]}
        onAddTransformation={onAddTransformation}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Column actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hide column' }));

    expect(onAddTransformation).toHaveBeenCalledTimes(1);
    expect(onAddTransformation).toHaveBeenCalledWith({
      id: 'organize',
      options: { excludeByName: { 'Column A': true } },
    });
  });
});
