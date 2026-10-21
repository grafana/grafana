# GMA rule-list search

A handwritten tokenizer and parser for the Alert rules and Recording rules search input. A query is a
flat sequence of free text and `key:value` tokens with no nesting, so a grammar library would add
files without adding anything.

## Syntax

- **Free text** searches rule titles: `cpu high`. A word is a filter only when it starts with one of
  the page's keys. Any other `key:value` word is title text, so `foo:bar` searches titles, and so does
  `metric:cpu` on the Alert rules page. `rule:cpu` is title text too, as in the old list.
- **`key:value`** filters: `folder:` and `datasource:` take UIDs and match them exactly. `folder:`
  replaces the old list's `namespace:`.
- **Quotes** keep spaces in a value and can start anywhere in it: `contactPoint:"on call"`,
  `"cpu high"`, `label:team="a b"`. Quoting text that would read as a filter keeps it title text:
  `"state:firing"`. Empty quotes are no text. There are no escapes, as in the old list: a backslash
  is an ordinary character, so a value can't contain a quote.
- **Repeats**: a single-value filter keeps its last value, so `state:firing state:normal` is
  `state:normal`. Folders, data sources, labels and title words add up.
- **Case**: `state:`, `health:` and `paused:` values ignore case. Keys don't: `State:firing` is title
  text.

### Label matchers

| Query               | Matches                 |
| ------------------- | ----------------------- |
| `label:team`        | has the label           |
| `label:!team`       | doesn't have the label  |
| `label:team=api`    | equals                  |
| `label:team!=api`   | doesn't equal           |
| `label:team=~api.*` | matches the regex       |
| `label:team!~api.*` | doesn't match the regex |

An empty value matches any value, so `label:team=` is `label:team`. As in Prometheus, `label:team!=` matches a non-empty value.

## Invalid filters

`parse(query, kind)` returns the filter and its issues, in two steps:

1. **Parsing** turns the text into the filter. It rejects a token only when the filter can't hold its
   value: a missing value (`label:`), a value outside the filter's set (`state:bogus`,
   `paused:maybe`), a label matcher with no key, or an unclosed quote anywhere in the query.
2. **Feedback** judges the result: the rejected tokens, values the filter can hold but the rule search
   refuses (`*` or `%` in text, `*` in exact values, data source UIDs it can't index), `contactPoint:`
   next to `policy:`, `panelId:` without `dashboard:`, and the filters the rule search can't serve
   yet, `policy:default` and `paused:false`.

So `state:bogus` is a parse rejection and `folder:f*` is feedback. The page sends no request while
there are issues.

The rule search validates the rest itself, such as label regexes. When it refuses a search (422), each
cause names its place in the request (`where.and[1].regex.pattern`), and `searchRejection.ts` maps it
back to the filter that built that leaf. The input shows it as `label was rejected: <reason>`, with no
Retry, since the same search would be refused again.

## Modules

A _token_ is a piece of the typed query. A _filter definition_ describes a filter a page supports; the
parser applies a token when one of the page's definitions accepts it.

- `tokenizer.ts`: the query into `RawToken`s.
- `ruleSearchFilter.ts`: the `RuleSearchFilter` model, and the API values each `state:` and `health:`
  value matches.
- `filterDefinitions.ts`, `alertFilters.ts`, `recordingFilters.ts`: each page's filters, in the order
  the search help lists them, with each kind's key type.
- `parser.ts`: `parse(query, kind)`, the parsing and feedback steps above. Label matchers reuse
  `parseMatcher` from `utils/matchers.ts`, as RuleList.v2 does.
- `useRuleListSearchState.ts`: the applied query, kept in the `search` URL parameter exactly as typed, and its filter.
- `RuleSearchInput.tsx`: the input and its help, built from the filter definitions.
- `searchRejection.ts`: a refused search (422) as issues, each naming the filter of the rejected leaf.
- `searchQueryLeaves.ts`: the request leaves both kinds share. `alert-rules/alertRuleSearchQuery.ts`
  builds the Alert request from them. The builder tests assert the exact `where` clause per query,
  typed by the generated request type; whether the server accepts it is the server's job.

## New filters

Filters the old list doesn't have:

| Token                           | Page      | Search field          |
| ------------------------------- | --------- | --------------------- |
| `paused:true` \| `paused:false` | Alert     | `paused`              |
| `panelId:<id>`                  | Alert     | `panelID`             |
| `metric:<name>`                 | Recording | `metric`              |
| `targetDatasource:<uid>`        | Recording | `targetDatasourceUID` |

`panelId:` needs `dashboard:`, because panel IDs are dashboard-local.

## `state:` and `health:`

`state:` (Alert rules) takes `firing`, `pending`, `recovering` or `normal`. `health:` takes `ok`,
`nodata`, `error` or `unknown`. The old list's `state:inactive` is invalid, and the search suggests
`state:normal` instead. `health:err` isn't accepted.
`state:normal` sends `state In [Healthy, Inactive]`, and `health:ok` sends `OK` on Alert rules and
`Recording` on Recording rules. A rule with no stored status matches none of them.
