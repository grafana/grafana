# SqlEditor Agent Notes

This folder contains generic SQL editor behavior used by SQL Expressions. Keep the editor code generic unless a caller-facing API makes SQL Expressions-specific behavior explicit.

## Completion Context

- Use the CodeMirror/Lezer SQL syntax tree to determine where the cursor is in the query.
- Avoid regex-driven SQL parsing for table, clause, alias, or qualified-column detection.
- Keep syntax-tree cursor interpretation in `completionSituation.ts`.
- Keep `utils.ts` focused on CodeMirror completion-source wiring, provider calls, and completion item mapping.

## Completion Behavior

- Generic SQL keyword completions come from CodeMirror's SQL language source in merge mode; avoid duplicating them in custom sources.
- Custom table and column completions should keep enough boost to surface above language/default suggestions.
- Qualified column completions should support table aliases from `FROM A AS a` and `JOIN B b`.
- Column lookups for multiple tables should stay concurrent because provider calls are independent.

## Tests

- Prefer behavior tests through `getSqlCompletionSource` rather than tests for private parsing helpers.
- Completion tests should create `EditorState` with the CodeMirror SQL language extension so the syntax tree exists.
