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

A token the page cannot apply is never dropped or ignored. That covers a `key:` outside the
page's token registry, an incomplete token (`label:` with no value yet, an unterminated quote),
a value the token does not accept (`paused:maybe`, `state:bogus`, `label:=api`), and a repeat of a
single-value token. `parse` records each in `criteria.invalid` exactly as written, `serialize`
writes it back unchanged, and `getCriteriaIssues` reports it, so the page shows it as an invalid
filter and sends no request until it is fixed.

The search input keeps the typed text as a draft and never takes the canonical form back.

## Modules

- `tokenizer.ts` — `tokenize(input)`: splits into `RawToken[]` with source spans.
- `labelMatcher.ts` — parses/serializes the value half of a `label:` token.
- `criteria.ts` — the `Criteria` model every page works with.
- `tokens.ts` — token types, `TOKEN_KEYS`, the shared `TokenDefinition`s and
  `buildTokenRegistry`.
- `alertTokens.ts` / `recordingTokens.ts` — each page's filter definitions, listed in the order
  the sidebar shows them. A definition carries the filter's `key`, `label`, `description`,
  `example`, and optionally the values it cannot search yet.
- `RuleSearchInput.tsx` builds its help from the definitions, and `FilterSidebar.tsx` builds the
  sidebar's fields, labels and order from the same ones; each page's sidebar supplies the control
  for each definition key. Adding a filter means adding one definition and its control.
- `parser.ts` — `parse(input, registry)`: `RawToken[]` → `Criteria`. Tokens the page
  cannot apply appear in `criteria.invalid`.
- `serializer.ts` — `serialize(criteria)`: canonical string form. `parse(serialize(c))`
  round-trips for any `Criteria` populated only from fields the given registry defines.
- `criteriaIssues.ts` — `getCriteriaIssues(criteria, kind)`: problems (an unsupported token, a
  `panelId` with no `dashboardUid`, `policy:default`, a value the rule search rejects such as a
  wildcard) the page must act on before issuing a request.
- `searchQueryLeaves.ts` — the rule search request types and the leaves shared by both
  kinds; `alert-rules/alertRuleSearchQuery.ts` and
  `recording-rules/recordingRuleSearchQuery.ts` build each kind's request body from `Criteria`;
  `alert-rules/alertRuleSearch.ts` and `recording-rules/recordingRuleSearch.ts` send it.
- `legacy-migration/migrationSync.ts` / `migrationResolve.ts` / `legacyUrlMigration.ts` — legacy
  URL → canonical URL migration pipeline; `legacyUrlMigration.ts` is the public entry point
  (`migrateLegacyRuleListUrl`).

## New tokens (no legacy equivalent)

Filters that didn't exist in the old combined list:

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

`state:` (Alert only) accepts `firing`, `pending`, `recovering`, `normal` and `inactive`; `health:`
(both pages) accepts `ok`, `nodata`, `error`, `err` and `unknown`, in any letter case. The request
builders send the API's own values: `state:normal` and `state:inactive` both send
`state In [Healthy, Inactive]`, and `health:ok` sends `OK` on Alert rules and `Recording` on
Recording rules. A rule with no stored status matches none of them.

`ruleSearchQueryContract.ts` mirrors what the per-kind rule search accepts, including these values,
so builder tests can assert every request stays inside it.
