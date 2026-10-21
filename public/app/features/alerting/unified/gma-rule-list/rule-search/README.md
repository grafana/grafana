# GMA rule-list search

A small handwritten tokenizer/parser for the Alert rules and Recording rules search input.
No Lezer grammar: the query language is a flat sequence of free text and filter tokens, kept
separate from the rule search request shape, so it never has to grow new syntax purely to
express the API's request structure.

## Syntax

A query is a flat, space-separated sequence of free text and `key:value` filter tokens.

- **Free text**: any word that doesn't start with one of the page's filter keys, e.g. `cpu high`.
  Matches on rule title. A word whose key the page has no filter for stays text, so `foo:bar`
  searches titles, and so does `metric:cpu` on the Alert rules page.
- **`key:value`**: e.g. `folder:folder-uid`. A value containing whitespace must be
  quoted: `contactPoint:"on call"`. `folder:` and `datasource:` take UIDs and match them exactly.
  `folder:` replaces the old list's `namespace:`, which the legacy URL migration converts.
- **Quoted free text**: `"cpu high"` — same meaning as unquoted free text, kept together.
  Text that would read as one of the page's filters is quoted too: `"state:firing"`.
- **`rule:value`**: equivalent to free text (both search rule titles); kept as a separate
  token because the legacy syntax has it. The rule search takes one title text, so a query has at
  most one `rule:`, joined with the free text.
- **Label matchers** (`label:...`):
  - `label:team` — key exists
  - `label:!team` — key does not exist (new; there is no legacy equivalent, so `!` was
    chosen to be consistent with the negation prefix already used by `!=`/`!~`)
  - `label:team=api` — equals
  - `label:team!=api` — not equals
  - `label:team=~api.*` — regex match
  - `label:team!~api.*` — negated regex match

A filter token the page cannot apply is never dropped or ignored. That covers an incomplete token (`label:` with no value yet, an unterminated quote),
a value the token does not accept (`paused:maybe`, `state:bogus`, `label:=api`), and a repeat of a
single-value token. `parse` records each in `filter.invalid` exactly as written, `serialize`
writes it back unchanged, and `getFilterIssues` reports it, so the page shows it as an invalid
filter and sends no request until it is fixed.

The search input shows what the user typed. Only a change to the query from elsewhere (sidebar,
saved search) replaces it.

## Modules

A _token_ is a piece of the typed query (free text or `key:value`). A _filter definition_ describes
a filter a page supports; the parser applies a token when a definition accepts it.

- `tokenizer.ts` — `tokenize(input)`: splits into `RawToken[]` with source spans.
- `labelMatcher.ts` — parses/serializes the value half of a `label:` token.
- `ruleSearchFilter.ts` — the `RuleSearchFilter` model every page works with.
- `filterDefinitions.ts` — the `FilterDefinition<Kind>` type, each kind's `FilterKey`s, the filters
  both pages share and `indexByKey`.
- `alertFilters.ts` / `recordingFilters.ts` — each page's filter definitions, in the order the
  search help lists them. A definition carries the filter's `key`, `label`, `description`,
  `example`, and optionally the values it cannot search yet.
- `RuleSearchInput.tsx` builds its help from the definitions.
- `parser.ts` — `parse(input, filters)`: `RawToken[]` → `RuleSearchFilter`. Tokens the page
  cannot apply appear in `filter.invalid`.
- `serializer.ts` — `serialize(filter)`: canonical string form. `parse(serialize(filter))`
  round-trips for any `RuleSearchFilter` populated only from fields the given filters define.
- `filterIssues.ts` — `getFilterIssues(filter, kind)`: problems (an unsupported token, a
  `panelId` with no `dashboardUid`, `contactPoint` next to `policy`, `policy:default`,
  `paused:false`, a value the rule search rejects such as a wildcard) the page must act on before
  issuing a request.
- `useRuleListSearchState.ts` — the page's applied filter and its issues, read from and written to
  the `search` URL parameter.
- `searchQueryLeaves.ts` — the rule search request types and the leaves shared by both kinds;
  `alert-rules/alertRuleSearchQuery.ts` builds the Alert request body from `RuleSearchFilter`, and
  `alert-rules/alertRuleSearch.ts` sends it.

## New filters (no legacy equivalent)

Filters that didn't exist in the old combined list:

| Token                           | Page      | Search field                                        |
| ------------------------------- | --------- | --------------------------------------------------- |
| `paused:true` \| `paused:false` | Alert     | `paused`                                            |
| `panelId:<id>`                  | Alert     | `panelID` (only sent when paired with `dashboard:`) |
| `metric:<name>`                 | Recording | `metric`                                            |
| `targetDatasource:<uid>`        | Recording | `targetDatasourceUID`                               |

`policy:default` is a reserved value (not a new token) for the default notification policy.
The rule search has no accepted request form for it yet, so it is reported by
`getFilterIssues` as unavailable and never sent. `paused:false` is unavailable the same way until
the rule search matches rules stored without a `paused` value. Each token definition lists its
unavailable values, so the search help can say why.

## `state:` / `health:`

`state:` (Alert only) accepts `firing`, `pending`, `recovering` and `normal`; `health:` (both
pages) accepts `ok`, `nodata`, `error` and `unknown`, in any letter case. The Prometheus-era
spellings `inactive` and `err` are not accepted. `ruleSearchFilter.ts` maps each value to the API
values it matches, typed by the generated client: `state:normal` sends `state In [Healthy, Inactive]`,
and `health:ok` sends `OK` on Alert rules and `Recording` on Recording rules. A rule with no stored
status matches none of them.

`mocks/ruleSearchQueryContract.ts` mirrors what the per-kind rule search accepts, including these
values, so builder tests can assert every request stays inside it.
