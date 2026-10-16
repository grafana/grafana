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

  it('uses a fixed dataset without enumerating other datasets', async () => {
    const db = buildMockDB();
    const onChange = jest.fn();
    render(
      <ControlledSelectors
        db={db}
        query={{ refId: 'A' }}
        onChange={onChange}
        dataset={{ mode: 'fixed', value: 'configured' }}
      />
    );

    await waitFor(() => expect(db.tables).toHaveBeenCalledWith('configured'));
    expect(db.datasets).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({
      refId: 'A',
      dataset: 'configured',
      table: undefined,
      sql: undefined,
      rawSql: '',
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

  it('updates the available datasets when the host switches to a fixed dataset', async () => {
    const db = buildMockDB();
    const props = { db, query: { refId: 'A', dataset: 'dataset1' }, onChange: jest.fn() };
    const { rerender } = render(<ControlledSelectors {...props} dataset={{ mode: 'select' }} />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dataset selector' })).toBeEnabled());

    rerender(<ControlledSelectors {...props} dataset={{ mode: 'fixed', value: 'configured' }} />);

    await waitFor(() => expect(db.tables).toHaveBeenLastCalledWith('configured'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dataset selector' })).toBeEnabled());
    await userEvent.click(screen.getByRole('combobox', { name: 'Dataset selector' }));
    expect(screen.queryByText('dataset2')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'configured' })).toBeVisible();
  });
});
