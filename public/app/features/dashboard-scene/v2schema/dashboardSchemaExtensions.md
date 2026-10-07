# Dashboard CodeMirror schema support

`dashboardSchemaExtensions.ts` is a Dashboard-owned adapter for the schema returned by
`fetchDashboardSchema()`. It does not install extensions in any production editor.

```ts
const schema = await fetchDashboardSchema();
const extensions = createDashboardSchemaExtensions(schema, {
  format: 'json',
  onValidationChange: setHasValidationErrors,
  onParseErrorChange: setHasSyntaxError,
});
```

Memoize extensions per schema, format, and callbacks. JSON extensions include the JSON
language, schema completion, and syntax/schema diagnostics. Each editor owns its schema;
reconfiguring one editor updates its validation and completion together. YAML extensions
validate the displayed buffer using `js-yaml`, then validate its JSON representation against
the same schema. YAML schema diagnostics use the document start, not offsets from the JSON
representation. The consumer supplies YAML highlighting through `language="yaml"`.

`createDashboardSchemaValidator(schema)` also exposes synchronous validation for Save/Apply
gates and content overrides, where an editor view may not exist. Its result distinguishes
parse errors from schema errors and provides JSON only for parseable buffers. Validation
does not rewrite the buffer, fill defaults, or strip plugin fields. Keep the consumer's
local YAML draft so comments and formatting survive edits and rerenders.

The existing `codemirror-json-schema` completion source supports Draft 7, but its bundled
validator uses Draft 4. Dashboard schemas use `const` and `if/then` for discriminated unions,
so validation uses `json-schema-library`'s Draft 7 engine directly. This adds a direct
dependency on the already-resolved version, with no new packages in the lockfile.

## Consumer inventory and migration boundaries

| Consumer                                                                         | Existing behavior to retain when wiring this adapter                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v2schema/DashboardSchemaEditor.tsx`                                             | Fetch the Dashboard resource schema; report validation and YAML parse state separately; keep invalid YAML local; block format switches on syntax errors; preserve read-only mode, callbacks, header actions, and content overrides.                                                                                                                  |
| `settings/JsonModelEditView.tsx` and `JsonModelEditViewRenderer.tsx`             | Only V2 uses the schema editor. Edits are a resource envelope; Save validates the envelope and unwraps `spec`. Keep the V1 path and Save behavior intact.                                                                                                                                                                                            |
| `sidebar/DashboardCodePane.tsx`                                                  | Disable Apply on validation errors; suppress diffs for unparseable buffers; retain the format preference and one active editor across expansion/collapse. Diff/content overrides still need validation of the current buffer.                                                                                                                        |
| `sidebar/codePaneUtils.ts` and `dashboardResource.ts`                            | Keep resource serialization, normalized diffs, V1 conversion, and envelope restrictions on metadata/kind/apiVersion separate from JSON Schema validation. Continue applying the edited `spec` through the existing action.                                                                                                                           |
| `settings/variables/` and `features/variables/editor/getVariableQueryEditor.tsx` | Query forms delegate to datasource-owned variable/query editors, including their completion providers. Regex/plain variable inputs use textareas. `StaticOptionsEditor.tsx` edits CSV with completion disabled. No Dashboard resource-schema completion editor exists in these variable forms; datasource query completion remains datasource-owned. |

Production wiring belongs to DPRO-432. Shared diff-editor replacement belongs to DPRO-327.
This PR leaves production editor, format, resource, and variable logic unchanged.

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
