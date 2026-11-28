# Grafana SQL Datasource Frontend Library

`@grafana/sql` is a collection of shared UI components, base classes, and utilities used to build SQL-based datasource plugins (MySQL, PostgreSQL, MSSQL, etc.) in [Grafana](https://github.com/grafana/grafana). It provides a common query editor, visual query builder, configuration components, and datasource base class for SQL datasources.

See [package source](https://github.com/grafana/grafana/tree/main/packages/grafana-sql) for more details.

## Installation

```bash
pnpm add @grafana/sql
```

```bash
npm install @grafana/sql
```

## Compose a visual query builder

Use `SqlQueryBuilder` and `SqlQueryBuilderSelectors` when a plugin has its own code
editor, execution controls, or validation UI. Neither component requires extending
`SqlDatasource` or runs the generated SQL. The existing `SqlQueryEditorLazy` remains the
complete editor with Builder/Code switching and built-in validation.

```tsx
import { type ReactNode } from 'react';

import {
  SqlQueryBuilder,
  SqlQueryBuilderSelectors,
  type DB,
  type SQLQuery,
  type SQLQueryBuilderDB,
} from '@grafana/sql';

interface BuilderProps {
  db: SQLQueryBuilderDB & Pick<DB, 'datasets' | 'tables'>;
  query: SQLQuery;
  onChange: (query: SQLQuery) => void;
  validation: ReactNode;
}

export function Builder({ db, query, onChange, validation }: BuilderProps) {
  return (
    <>
      <SqlQueryBuilderSelectors
        db={db}
        query={query}
        onChange={onChange}
        dataset={{ mode: 'select', label: 'Schema' }}
      />
      <SqlQueryBuilder db={db} query={query} onChange={onChange}>
        {validation}
      </SqlQueryBuilder>
    </>
  );
}
```

The builder's `SQLQueryBuilderDB` adapter only needs `fields`, `functions`, and
`toRawSql`. The selectors additionally need `datasets` and `tables`. Keep the
adapter stable across renders. For a schema-based service, map datasets to schemas
and use `query.dataset` when resolving columns or generating qualified table names.
The adapter owns SQL dialect, identifier quoting, and supported function choices.
Replacing the adapter refreshes selector metadata even if the selected dataset is unchanged.

Dataset selection is independent of SQL dialect:

- `{ mode: 'select', label: 'Schema' }` lists `db.datasets()` and uses the selected
  `query.dataset` to load tables. This is the default mode; the default label is
  `Dataset`.
- `{ mode: 'fixed', value: 'database' }` selects the configured dataset without
  enumerating alternatives.
- `{ mode: 'hidden', value: 'database' }` omits the dataset selector. `value` supplies
  a fallback for table discovery when `query.dataset` is absent; callers must
  provide any corresponding SQL-generation context themselves.

Changing datasets clears the table, builder expression, and generated SQL.
Initializing a missing or empty dataset from a fixed value preserves the existing table and SQL.
Changing tables clears the expression and SQL. Other query properties are retained.
Builder edits call `db.toRawSql` and return the updated expression and `rawSql`
through `onChange`; the host decides when to execute it. Only a missing `sql`
expression receives builder defaults. The host retains ownership of `editorMode`
and `format`; set `format: QueryFormat.Timeseries` to offer time/value aliases.

The `queryRowFilter` prop controls the filter, group, order, and SQL preview rows;
all four are visible by default. Render custom validation as children, or omit
children to disable validation. The builder never calls `db.validateQuery`, even
if a full `DB` is supplied. Time-series output, fill behavior, and authorization
remain responsibilities of the datasource backend.

See **Plugins / SQL query builder** in Storybook for selectable, fixed, and hidden dataset
examples with host-owned feedback: run `yarn storybook` from the repository root.
