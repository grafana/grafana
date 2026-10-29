import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { type SQLQuery } from '../types';

import { buildMockDB } from './SqlComponents.testHelpers';
import { SqlQueryBuilderSelectors, type SqlQueryBuilderSelectorsProps } from './SqlQueryBuilderSelectors';

function ControlledSelectors(props: SqlQueryBuilderSelectorsProps) {
  const [query, setQuery] = useState(props.query);
  return (
    <SqlQueryBuilderSelectors
      {...props}
      query={query}
      onChange={(next) => {
        props.onChange(next);
        setQuery(next);
      }}
    />
  );
}

describe('SqlQueryBuilderSelectors', () => {
  it('reloads schemas and tables when the adapter changes with the same selected schema', async () => {
    const first = {
      datasets: jest.fn(async () => ['public', 'first_schema']),
      tables: jest.fn(async () => ['first_table']),
    };
    const second = {
      datasets: jest.fn(async () => ['public', 'second_schema']),
      tables: jest.fn(async () => ['second_table']),
    };
    const props = { query: { refId: 'A', dataset: 'public' }, onChange: jest.fn() };
    const { rerender } = render(<SqlQueryBuilderSelectors {...props} db={first} />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Table selector' })).toBeEnabled());

    rerender(<SqlQueryBuilderSelectors {...props} db={second} />);

    await waitFor(() => expect(second.tables).toHaveBeenCalledWith('public'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Table selector' })).toBeEnabled());
    await userEvent.click(screen.getByRole('combobox', { name: 'Table selector' }));
    expect(screen.getByRole('option', { name: 'second_table' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'first_table' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('combobox', { name: 'Dataset selector' }));
    expect(screen.getByRole('option', { name: 'second_schema' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'first_schema' })).not.toBeInTheDocument();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('loads selectable schemas and clears the old table and SQL when the schema changes', async () => {
    const db = buildMockDB();
    const onChange = jest.fn();
    const query: SQLQuery = {
      refId: 'A',
      dataset: 'dataset1',
      table: 'old_table',
      rawSql: 'SELECT value FROM old_table',
      sql: { limit: 25 },
      hide: true,
    };
    render(
      <ControlledSelectors db={db} query={query} onChange={onChange} dataset={{ mode: 'select', label: 'Schema' }} />
    );

    await waitFor(() => expect(db.tables).toHaveBeenCalledWith('dataset1'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dataset selector' })).toBeEnabled());
    await userEvent.click(screen.getByRole('combobox', { name: 'Dataset selector' }));
    await userEvent.click(await screen.findByText('dataset2'));

    expect(onChange).toHaveBeenLastCalledWith({
      refId: 'A',
      dataset: 'dataset2',
      table: undefined,
      rawSql: '',
      sql: undefined,
      hide: true,
    });
    await waitFor(() => expect(db.tables).toHaveBeenLastCalledWith('dataset2'));
    expect(screen.getByText('Schema')).toBeVisible();
  });

  it('clears builder SQL when the table changes without changing the selected schema', async () => {
    const db = buildMockDB();
    const onChange = jest.fn();
    render(
      <ControlledSelectors
        db={db}
        query={{ refId: 'B', dataset: 'dataset1', table: 'table1', rawSql: 'old SQL', sql: { limit: 10 } }}
        onChange={onChange}
      />
    );

    await waitFor(() => expect(db.tables).toHaveBeenCalledWith('dataset1'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Table selector' })).toBeEnabled());
    await userEvent.click(screen.getByRole('combobox', { name: 'Table selector' }));
    await userEvent.click(await screen.findByText('table2'));

    expect(onChange).toHaveBeenLastCalledWith({
      refId: 'B',
      dataset: 'dataset1',
      table: 'table2',
      rawSql: '',
      sql: undefined,
    });
  });

  it.each([undefined, ''])('preserves table and SQL when initializing a fixed dataset from %p', async (dataset) => {
    const db = buildMockDB();
    const onChange = jest.fn();
    const query: SQLQuery = {
      refId: 'A',
      dataset,
      table: 'table1',
      sql: { limit: 25 },
      rawSql: 'SELECT value FROM table1 LIMIT 25',
      hide: true,
    };
    render(
      <ControlledSelectors db={db} query={query} onChange={onChange} dataset={{ mode: 'fixed', value: 'configured' }} />
    );

    await waitFor(() => expect(db.tables).toHaveBeenCalledWith('configured'));
    expect(db.datasets).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({
      ...query,
      dataset: 'configured',
    });
    expect(screen.getByText('configured')).toBeVisible();
  });

  it('hides dataset selection while loading tables from the supplied dataset', async () => {
    const db = buildMockDB();
    const onChange = jest.fn();
    render(
      <SqlQueryBuilderSelectors
        db={db}
        query={{ refId: 'A' }}
        onChange={onChange}
        dataset={{ mode: 'hidden', value: 'configured' }}
      />
    );

    await waitFor(() => expect(db.tables).toHaveBeenCalledWith('configured'));
    expect(screen.queryByRole('combobox', { name: 'Dataset selector' })).not.toBeInTheDocument();
    expect(db.datasets).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears table and SQL and updates options when switching to a different fixed dataset', async () => {
    const db = buildMockDB();
    const props = {
      db,
      query: {
        refId: 'A',
        dataset: 'dataset1',
        table: 'table1',
        sql: { limit: 25 },
        rawSql: 'SELECT value FROM table1',
      },
      onChange: jest.fn(),
    };
    const { rerender } = render(<ControlledSelectors {...props} dataset={{ mode: 'select' }} />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dataset selector' })).toBeEnabled());

    rerender(<ControlledSelectors {...props} dataset={{ mode: 'fixed', value: 'configured' }} />);

    await waitFor(() => expect(db.tables).toHaveBeenLastCalledWith('configured'));
    expect(props.onChange).toHaveBeenLastCalledWith({
      refId: 'A',
      dataset: 'configured',
      table: undefined,
      sql: undefined,
      rawSql: '',
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dataset selector' })).toBeEnabled());
    await userEvent.click(screen.getByRole('combobox', { name: 'Dataset selector' }));
    expect(screen.queryByText('dataset2')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'configured' })).toBeVisible();
  });
});
