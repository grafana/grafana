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

`parse(query, schema)` returns the page's filter and its issues, in two steps:

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
- `sharedRuleFilter.ts`: `SharedRuleFilter`, what both pages' filters hold, and the API values each
  `health:` value matches. Each page extends it: `AlertRuleFilter` in `alert-rules/alertRuleFilters.ts`
  and `RecordingRuleFilter` in `recording-rules/recordingRuleFilters.ts`, with the page's search schema.
- `filterDefinitions.ts`: `RuleSearchSchema`, `FilterDefinition` and `FilterHelp`. A definition owns
  everything about one filter: its help, `apply` for the parsing step, `feedback` for the feedback step,
  and the renamed values it suggests a replacement for. The search input reads only the `FilterHelp` part. A schema is typed by its page's key union, so a definition can't
  join a page that has no such filter.
- `sharedFilters.ts`: the filters both pages share. Label matchers reuse `parseMatcher` from
  `utils/matchers.ts`, as RuleList.v2 does.
- `parser.ts`: `parse(query, schema)`, which runs the page's definitions through the parsing and
  feedback steps above. It knows no filter itself, except free text and its wildcards.
- `useRuleListSearchState.ts`: the applied query, kept in the `search` URL parameter exactly as typed, and the
  page's filter.
- `RuleSearchInput.tsx`: the input and its help, built from the filter definitions.
- `searchRejection.ts`: a refused search (422) as issues, each naming the filter of the rejected leaf.
- `searchQueryLeaves.ts`: the request leaves both kinds share. `alert-rules/alertRuleSearchQuery.ts` and
  `recording-rules/recordingRuleSearchQuery.ts` build each page's request from them. The builder tests
  assert the exact `where` clause per query, typed by the generated request type; whether the server
  accepts it is the server's job.

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
