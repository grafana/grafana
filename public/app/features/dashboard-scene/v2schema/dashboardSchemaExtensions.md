# Dashboard CodeMirror schema support

`dashboardSchemaExtensions.ts` is a Dashboard-owned adapter for the schema returned by
`fetchDashboardSchema()`. `DashboardSchemaEditor` installs it for V2 settings and Edit as code.

```ts
const schema = await fetchDashboardSchema();
const extensions = createDashboardSchemaExtensions(schema, {
  format: 'json',
  onValidationChange: setHasValidationErrors,
  onParseErrorChange: setHasSyntaxError,
});
```

Memoize extensions per schema, format, and callbacks. JSON extensions include the JSON
language, schema completion, and syntax/schema diagnostics.

JSON errors appear in an overview ruler beside the scrollbar. The ruler shows error locations
across the whole buffer; clicking a marker selects and scrolls to the error. Markers clear
when validation succeeds.

`DashboardSchemaEditor` enables the shared `CodeMirrorEditor`'s `overviewRuler` prop for JSON.
The shared editor owns rendering, positioning, navigation, and lazy loading; this adapter
only supplies validation diagnostics.

Each editor owns its schema; reconfiguring one editor updates its validation and completion
together. YAML extensions
validate the displayed buffer using `js-yaml`, then validate its JSON representation against
the same schema. YAML schema diagnostics use the document start, not offsets from the JSON
representation. The consumer supplies YAML highlighting through `language="yaml"`.

`createDashboardSchemaValidator(schema)` exposes validation for Save/Apply gates and content
overrides, where an editor view may not exist. The editor blocks Save/Apply immediately on
edits, then validates after a 100 ms pause. The linter and the buffer check share a validator
that caches its last result, so they do not repeat schema validation for the same buffer.
The change handler only parses YAML into JSON; it never runs schema validation. The
validator's result distinguishes parse errors from schema errors and provides JSON only
for parseable buffers. Validation does not rewrite the buffer, fill defaults, or strip
plugin fields. Keep the consumer's local YAML draft so comments and formatting survive
edits and rerenders.
If the schema tooling fails to load, the editor shows a read-only buffer with a reload
message and keeps Save/Apply disabled.

Dashboard schemas use `const` and `if/then` for discriminated unions. Validation and
completion use `json-schema-library`'s Draft 7 engine directly. Completion compiles its
schema before editing and resolves only the schema at the cursor. The package completion
source resolves every sibling schema on each request, which stalls typing with the full
Dashboard schema. Property names, enum/constant/default values, and boolean/null values
come from the same fetched schema. This adds a direct dependency on the already-resolved
version, with no new packages in the lockfile.

## Consumer inventory and migration boundaries

| Consumer                                                                         | Behavior preserved by the migration                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v2schema/DashboardSchemaEditor.tsx`                                             | Fetch the Dashboard resource schema; report validation and YAML parse state separately; keep invalid YAML local; block format switches on syntax errors; preserve read-only mode, callbacks, header actions, and content overrides.                                                                                                                  |
| `settings/JsonModelEditView.tsx` and `JsonModelEditViewRenderer.tsx`             | Only V2 uses the schema editor. Edits are a resource envelope; Save validates the envelope and unwraps `spec`. Keep the V1 path and Save behavior intact.                                                                                                                                                                                            |
| `sidebar/DashboardCodePane.tsx`                                                  | Disable Apply on validation errors; suppress diffs for unparseable buffers; retain the format preference and one active editor across expansion/collapse. Diff/content overrides still need validation of the current buffer.                                                                                                                        |
| `sidebar/codePaneUtils.ts` and `dashboardResource.ts`                            | Keep resource serialization, normalized diffs, V1 conversion, and envelope restrictions on metadata/kind/apiVersion separate from JSON Schema validation. Continue applying the edited `spec` through the existing action.                                                                                                                           |
| `settings/variables/` and `features/variables/editor/getVariableQueryEditor.tsx` | Query forms delegate to datasource-owned variable/query editors, including their completion providers. Regex/plain variable inputs use textareas. `StaticOptionsEditor.tsx` edits CSV with completion disabled. No Dashboard resource-schema completion editor exists in these variable forms; datasource query completion remains datasource-owned. |

The adapter and its production consumer ship together. Shared diff-editor replacement
belongs to DPRO-327. V1 settings, resource serialization, and variable editors retain their
existing implementations.

## Compatibility evidence

`dashboardSchemaFetcher.test.ts` passes the checked-in V2 and V2beta1 OpenAPI schemas
through the existing fetcher, including its reference rewriting and OpenAPI corrections.
It validates a complete dashboard, rejects an invalid title, and completes layout-kind
values. The migration input fixture is normalized explicitly to current row, array, and
transformation shapes; the generated schema itself is unchanged.

`dashboardSchemaExtensions.test.ts` covers JSON diagnostic ranges, required properties,
strict JSON syntax, YAML schema/parse errors and recovery, completion, and per-editor
schema reconfiguration. Only the package's Shiki tooltip renderer is replaced in Jest;
the schema engine and completion source run unmocked.

## Large-dashboard measurements

A Chromium harness used the checked-in `v2beta1.complete.json` fixture, normalized as in
the compatibility test, with its first panel repeated 200 times. The fetched V2 schema and
validator were compiled before timing. These are medians of seven runs on formatted buffers
(609 KB JSON, 388 KB YAML); schema-error cases set `spec.title` to a number.

| Buffer             | Before: two synchronous schema checks | After: synchronous parsing |
| ------------------ | ------------------------------------- | -------------------------- |
| JSON, valid        | 54.7 ms                               | 0.7 ms                     |
| JSON, schema error | 249.7 ms                              | 0.7 ms                     |
| YAML, valid        | 63.2 ms                               | 5.5 ms                     |
| YAML, schema error | 63.4 ms                               | 5.3 ms                     |

The JSON change handler forwards the raw text; its render-time syntax check parses JSON.
YAML edits parse and serialize to JSON. These measurements cover that synchronous work,
not React rendering or painting. Full schema validation and diagnostic generation still
run on the main thread after a 100 ms pause, once per buffer shared with the linter.
