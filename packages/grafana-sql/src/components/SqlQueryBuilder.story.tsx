import { type Meta, type StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Alert, Stack } from '@grafana/ui';

import { COMMON_FNS } from '../constants';
import { QueryEditorExpressionType } from '../expressions';
import { type DB, type SQLQuery, type SQLQueryBuilderDB } from '../types';
import { createSelectClause, haveColumns } from '../utils/sql.utils';

import { SqlQueryBuilderSelectors, type SQLDatasetSelector } from './SqlQueryBuilderSelectors';
import { SqlQueryBuilder } from './visual-query-builder/SqlQueryBuilder';

const db: SQLQueryBuilderDB & Pick<DB, 'datasets' | 'tables'> = {
  datasets: async () => ['analytics', 'archive'],
  tables: async () => ['events', 'requests'],
  fields: async () => [
    { value: 'service', type: 'text', raqbFieldType: 'text' },
    { value: 'duration', type: 'double precision', raqbFieldType: 'number' },
  ],
  functions: () =>
    COMMON_FNS.map((fn) => ({
      ...fn,
      parameters: [{ name: 'Column', required: true, options: () => db.fields({ refId: 'A' }) }],
    })),
  toRawSql: ({ dataset, table, sql }) => {
    if (!table || !sql || !haveColumns(sql.columns)) {
      return '';
    }
    return [
      createSelectClause(sql.columns),
      `FROM ${dataset}.${table}`,
      sql.whereString && `WHERE ${sql.whereString}`,
      sql.groupBy?.[0]?.property.name && `GROUP BY ${sql.groupBy.map((group) => group.property.name).join(', ')}`,
      sql.orderBy?.property.name && `ORDER BY ${sql.orderBy.property.name} ${sql.orderByDirection ?? 'ASC'}`,
      sql.limit !== undefined && `LIMIT ${sql.limit}`,
    ]
      .filter(Boolean)
      .join(' ');
  },
};

function StandaloneBuilder({ dataset }: { dataset: SQLDatasetSelector }) {
  const [query, setQuery] = useState<SQLQuery>({
    refId: 'A',
    dataset: 'analytics',
    table: 'events',
    rawSql: 'SELECT AVG(duration) FROM analytics.events LIMIT 50',
    sql: {
      columns: [
        {
          type: QueryEditorExpressionType.Function,
          name: 'AVG',
          parameters: [{ type: QueryEditorExpressionType.FunctionParameter, name: 'duration' }],
        },
      ],
      limit: 50,
    },
  });
  return (
    <Stack direction="column" gap={2}>
      <SqlQueryBuilderSelectors db={db} query={query} onChange={setQuery} dataset={dataset} />
      <SqlQueryBuilder db={db} query={query} onChange={setQuery}>
        <Alert title="Custom validation" severity="info">
          The host supplies this feedback. This example uses sample metadata and does not execute queries.
        </Alert>
      </SqlQueryBuilder>
    </Stack>
  );
}

const meta: Meta<typeof StandaloneBuilder> = {
  title: 'Plugins/SQL query builder',
  component: StandaloneBuilder,
  parameters: {
    layout: 'padded',
    a11y: {
      // shortcut: Exclude Monaco's duplicate live-region landmarks until Monaco fixes their roles.
      context: { exclude: ['.monaco-aria-container .monaco-status'] },
    },
  },
};
export default meta;

type Story = StoryObj<typeof StandaloneBuilder>;

export const SelectableSchema: Story = {
  args: { dataset: { mode: 'select', label: 'Schema' } },
};

export const FixedDatabase: Story = {
  args: { dataset: { mode: 'fixed', value: 'analytics' } },
};

export const HiddenDataset: Story = {
  args: { dataset: { mode: 'hidden', value: 'analytics' } },
};
