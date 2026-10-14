# GMA rule-list search

A small handwritten tokenizer/parser for the Alert rules and Recording rules search input.
No Lezer grammar: the query language is a flat sequence of free text and filter tokens, kept
separate from the rule search request shape, so it never has to grow new syntax purely to
express the API's request structure.

## Syntax

A query is a flat, space-separated sequence of free text and `key:value` filter tokens.

- **Free text**: any word without a recognized `key:` prefix, e.g. `cpu high`. Matches on
  rule title.
- **`key:value`**: e.g. `namespace:folder-uid`. A value containing whitespace must be
  quoted: `namespace:"My Folder"`.
- **Quoted free text**: `"cpu high"` — same meaning as unquoted free text, kept together.
- **`rule:value`**: equivalent to free text (both search rule titles); kept as a separate
  token because the legacy syntax has it.
- **Label matchers** (`label:...`):
  - `label:team` — key exists
  - `label:!team` — key does not exist (new; there is no legacy equivalent, so `!` was
    chosen to be consistent with the negation prefix already used by `!=`/`!~`)
  - `label:team=api` — equals
  - `label:team!=api` — not equals
  - `label:team=~api.*` — regex match
  - `label:team!~api.*` — negated regex match

An unknown `key:` (not in the page's token registry) and an incomplete token (`label:` with
no value yet, or an unterminated quote) are never dropped: they round-trip through
`parse`/token list as drafts so a user's in-progress typing, or a filter this page doesn't
support, isn't silently destroyed.

## Modules

- `tokenizer.ts` — `tokenize(input)`: splits into `RawToken[]` with source spans.
- `labelMatcher.ts` — parses/serializes the value half of a `label:` token.
- `criteria.ts` — the `Criteria` model every page works with.
- `tokens.ts` — token types, `TOKEN_KEYS`, the shared `TokenDefinition`s and
  `buildTokenRegistry`.
- `alertTokens.ts` / `recordingTokens.ts` — the per-page registries built from shared +
  kind-specific `TokenDefinition`s (key, description, example, `availability`).
- `parser.ts` — `parse(input, registry)`: `RawToken[]` → `{ tokens, criteria }`. Unknown or
  incomplete tokens still appear in `tokens`, never in `criteria`.
- `serializer.ts` — `serialize(criteria)`: canonical string form. `parse(serialize(c))`
  round-trips for any `Criteria` populated only from fields the given registry defines.
- `criteriaIssues.ts` — `getCriteriaIssues(criteria, kind)`: problems (an unresolved migrated
  name, a `panelId` with no `dashboardUid`, `policy:default`, a value the rule search rejects
  such as a wildcard) the page must act on before issuing a request.
- `searchQueryLeaves.ts` — the rule search request types and the leaves shared by both
  kinds; `alert-rules/alertRuleSearchQuery.ts` and
  `recording-rules/recordingRuleSearchQuery.ts` build each kind's request body from `Criteria`;
  `alert-rules/alertRuleSearch.ts` and `recording-rules/recordingRuleSearch.ts` send it.
- `legacy-migration/migrationSync.ts` / `migrationResolve.ts` / `legacyUrlMigration.ts` — legacy
  URL → canonical URL migration pipeline; `legacyUrlMigration.ts` is the public entry point
  (`migrateLegacyRuleListUrl`).

## New tokens (no legacy equivalent)

Chosen for filters that didn't exist in the old combined list — not yet used anywhere else,
so flagging the exact names here for review:

| Token                           | Page      | Search field                                        |
| ------------------------------- | --------- | --------------------------------------------------- |
| `paused:true` \| `paused:false` | Alert     | `paused`                                            |
| `panelId:<id>`                  | Alert     | `panelID` (only sent when paired with `dashboard:`) |
| `metric:<name>`                 | Recording | `metric`                                            |
| `targetDatasource:<uid>`        | Recording | `targetDatasourceUID`                               |

`policy:default` is a reserved value (not a new token) for the default notification policy.
The rule search has no accepted request form for it yet, so it is reported by
`getCriteriaIssues` as unavailable and never sent.

## `state:` / `health:`

Both tokens parse and round-trip (so a typed or migrated URL isn't mangled), but neither
`buildAlertRuleSearchQuery` nor `buildRecordingRuleSearchQuery` ever emits a leaf for them:
filtering on these fields isn't deployed yet. They are marked `availability: 'pending'` in
their `TokenDefinition` for the sidebar/help UI to show as visible-but-disabled.
