# SQL Editor Completion Terms

This folder contains the generic SQL completion logic used by the SQL editor. Most of the names in
`completionSituation.ts` come from SQL grammar concepts, plus a few CodeMirror completion terms.

## Mental Model

Completion works in two steps:

1. `completionSituation.ts` reads the CodeMirror SQL syntax tree and describes where the cursor is.
2. `utils.ts` uses that situation to call the completion provider for tables, columns, or functions.

For example:

```sql
SELECT a.
FROM A AS a
```

The cursor after `a.` is a qualified column situation. The qualifier is `a`, which resolves to table `A`,
so `utils.ts` asks the provider for columns with `{ table: 'A' }`.

## SQL Terms

### Identifier

An identifier is a SQL name, such as a table name, alias, or column name.

```sql
SELECT value FROM A
```

`value` and `A` are identifiers.

This code currently handles unquoted identifiers. SQL generally treats unquoted identifiers as
case-insensitive, so `A` and `a` should resolve to the same table name.

### Table Ref

A table ref is a table that appears in the query's `FROM` or `JOIN` scope.

```sql
SELECT value
FROM A
JOIN B ON A.time = B.time
```

`A` and `B` are table refs. When the cursor is in a place that can use columns from these tables,
completion can ask for columns from each table ref.

### Alias

An alias is a shorter or alternate name for a table ref.

```sql
SELECT a.value
FROM A AS a
```

`a` is an alias for table `A`. The editor should resolve `a.` to columns from `A`.

Aliases can also be implicit:

```sql
SELECT b.value
FROM B b
```

Here `b` is an alias for `B`.

### Qualifier

A qualifier is the part before the dot in a qualified column reference.

```sql
SELECT A.value FROM A
SELECT a.value FROM A AS a
```

In the first query, `A` is the qualifier. In the second query, `a` is the qualifier.

### Qualified Column

A qualified column is a column written with a qualifier and a dot.

```sql
A.value
a.value
```

When the user has typed only the prefix:

```sql
SELECT a.
FROM A AS a
```

the completion source should suggest columns for `A`.

### Global Table-Qualified Completion

Sometimes a qualifier is not in the query's `FROM` or `JOIN` scope yet:

```sql
SELECT A.
```

In that case, `utils.ts` can fall back to the optional `tables()` provider. If the provider knows table
`A`, the editor can still ask for columns from `A`.

## CodeMirror Terms

### Word

The current word is the partial text CodeMirror finds immediately before the cursor.

```sql
SELECT val
```

With the cursor after `val`, the word is `val`. Completion uses this to decide where replacement
starts.

### From

`from` is the document position where the completion replacement starts.

For `A.val`, column completion should replace only `val`, not `A.`. That means `from` points to the
start of `val`.

### Explicit Completion

Explicit completion means the user intentionally opened completion, such as with a keyboard shortcut.
Implicit completion means CodeMirror opened completion while typing.

Some empty-word situations return no completions unless completion is explicit.

## Completion Situation Types

### `qualified-column`

The cursor is after a qualifier and dot.

```sql
SELECT a.
FROM A AS a
```

The situation includes the resolved table and whether the qualifier came from a parsed table ref or
alias.

### `table`

The cursor is in a position where table names make sense.

```sql
SELECT *
FROM
```

The completion source asks the provider for table completions.

### `general`

The cursor is in a normal expression position.

```sql
SELECT val
FROM A
```

The completion source asks for columns from in-scope tables and custom functions.

### `none`

The cursor is somewhere completion should not run, such as after a terminated statement or after
whitespace when completion was not explicit and there is no useful context.
