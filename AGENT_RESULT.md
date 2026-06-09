## Root Cause

When building WHERE clauses in the InfluxQL visual query editor, the code that renders `::field` tag conditions did not use the field's actual InfluxDB type (string, integer, float, boolean). Instead it inferred type from the value's appearance (e.g. numeric-looking string `"10"` was treated as integer). This caused queries like `"myfield"::field = 10` for a field that stores string values, returning no results because InfluxDB type-checks field comparisons strictly.

There were two root causes:
1. `InfluxQueryModel.renderTagCondition` (and `isOperatorTypeHandler`) inferred type from the value string, ignoring the actual InfluxDB field type.
2. `ResponseParser.parse()` discarded the field type column returned by `SHOW FIELD KEYS` (which returns `[fieldKey, fieldType]` pairs) - only `value[0]` was kept, `value[1]` (the type) was thrown away.

## Change Made

### `public/app/plugins/datasource/influxdb/types.ts`
- Added `dataType?: string` to `InfluxQueryTag` interface. Stores the InfluxDB field type (`string`, `integer`, `float`, `boolean`) for `::field` keys.

### `public/app/plugins/datasource/influxdb/response_parser.ts`
- Changed `ResponseParser.parse()` internal dedup container from `Set<string>` to `Map<string, {text, value?}>` to carry extra metadata.
- For `SHOW FIELD KEYS` queries, stores `value[1]` (field type) as `MetricFindValue.value` in the returned array.

### `public/app/plugins/datasource/influxdb/datasource.ts`
- Updated `InfluxDatasource.toMetricFindValue()` to detect a `fieldType` column in the backend DataFrame response and store it as `MetricFindValue.value`. Used for the backend migration path.

### `public/app/plugins/datasource/influxdb/influxql_metadata_query.ts`
- Updated `runExploreQuery` return type to expose `value?: string | number` (matching `MetricFindValue`).
- Added new exported function `getFieldKeysWithTypes()` that returns `Array<{name: string; type: string}>`.

### `public/app/plugins/datasource/influxdb/components/editor/query/influxql/visual/VisualInfluxQLEditor.tsx`
- Added `fieldTypeMap` useMemo that calls `getFieldKeysWithTypes()` and builds a `Map<fieldname::field, type>`.
- Added `getTagKeyDataType` useMemo (async lookup function) that returns the InfluxDB type for a given `::field` key.
- Passes `getTagKeyDataType` to `TagsSection`.

### `public/app/plugins/datasource/influxdb/components/editor/query/influxql/visual/TagsSection.tsx`
- Added optional `getTagKeyDataType?: (key: string) => Promise<string | undefined>` to `Props` and `TagProps`.
- Updated the key-change handler in `Tag` to call `getTagKeyDataType` when user selects a `::field` key, setting `dataType` on the tag.
- Updated `addNewTag` similarly for new tags added via the `+` button.

### `public/app/plugins/datasource/influxdb/influx_query_model.ts`
- Updated `InfluxQueryModel.isOperatorTypeHandler()` to accept an optional `dataType` parameter. When present, uses it directly for quoting decisions instead of inferring from the value.
- Updated `InfluxQueryModel.renderTagCondition()` to pass `tag.dataType` to `isOperatorTypeHandler` and to use `tag.dataType` for `=`, `!=`, `<>` operators on `::field` keys (skips quoting for non-string types, lowercases for boolean).

## Testing

Added tests in `public/app/plugins/datasource/influxdb/influx_query_model.test.ts`:
- String `::field` with `=` operator quotes the value correctly
- Integer `::field` with `=` operator does not quote the value
- Float `::field` with `!=` operator does not quote the value
- Boolean `::field` with `=` operator lowercases but does not quote
- String `::field` with `Is` operator quotes a numeric-looking value (the bug scenario)
- Integer `::field` with `Is Not` operator does not quote

Added tests in `public/app/plugins/datasource/influxdb/response_parser.test.ts`:
- `SHOW FIELD KEYS` response sets `value: 'float'` on the returned MetricFindValue
- Multiple fields with different types all have their types stored correctly

The node_modules in this environment is incomplete (several packages have empty build directories, including `jest-cli`, `find-up`, and others), preventing the test suite from running. The test logic and code changes have been reviewed manually for correctness.

## Lint

The changes are TypeScript-only; no Go files were modified so `make lint-go` is not applicable. Frontend linting (`make lint-frontend`) could not be run due to the incomplete node_modules state (same issue as tests - the linter toolchain relies on the same missing packages).
