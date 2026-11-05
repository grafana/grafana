# Review wording reference

The exact English the Review tab uses. The corpus (`cases/*.ts`) is written against this file; when the
two disagree, the corpus case is the spec and this file is fixed. Every string goes through `t()` with a
key under `dashboard-scene.review.*`; values that come from the dashboard (titles, names, query text,
option values) are shown as they are stored, unquoted, unless a rule below says otherwise.

**Names and titles are always in double quotes** (`"Errors"`, never `'Errors'`), and an element is always
named **type first, then its name**: `Panel "Latency"`, `Row "EU Cluster"`, `Tab "Memory"`,
`Query variable "env"`, `Query "B"`. This applies everywhere a name appears: node headers, section paths, change
lines, move texts, `removed with it`, System defaults owners.

**Added and removed elements are marked + / −.** The UI shows a green + or a red − (the corpus text shows
`+ ` / `- `). A node header (panel, row, tab) also says what happened: `+ Added Panel "Saturation"`,
`- Removed Row "DB"` (§3). A change line about one element (one with a `subject`, see §8) carries only the
element's name: `+ Query "B"`,
`- Variable "region"`, `+ Tag "slo"`, `- Override "errors"`,
`+ Template variable "cluster" Equals "blue"`. Every element that can be added or removed has a subject
(§8), so no line says "added" or "removed" about an element; only values do (`Description: added`).

Notation: `<x>` is a placeholder, `›` (U+203A, with a space on each side) separates label segments, `→`
(U+2192, with a space on each side) separates before and after.

## 1. Category labels

| Category key  | Label (group header)  | In a collapsed summary |
| ------------- | --------------------- | ---------------------- |
| properties    | Properties            | properties             |
| layout        | Layout                | layout                 |
| controls      | Controls              | controls               |
| repeat        | Repeat                | repeat                 |
| showHide      | Conditional rendering | conditional rendering  |
| data          | Data                  | data                   |
| visualization | Visualization         | visualization          |
| pluginOptions | Plugin options        | plugin options         |
| fieldConfig   | Field config          | field config           |
| other         | Other                 | other                  |

The lowercase forms are separate i18n keys (lowercasing is not safe in every language).

## 2. Node labels

### Dashboard

`Dashboard`

### Names and positions

Name an element the way a person points at it: type first, then its title in double quotes. When the name
alone is ambiguous, add **its 1-based position in reading order within its section** (grid: by `y`, then
`x`; auto grid, rows, tabs: array order; counted over all siblings), phrased `at position N`. Never ordinal
suffixes (`2nd`), never `(in Tab …)` where the tree already shows the section.

A name is **ambiguous** when another sibling in the same section has the same title, and always for an
untitled element that shares its section with another untitled one. Positions come from the payload for
existing and added elements, from the baseline for removed ones.

| Situation                           | Panel                             | Row / tab segment             |
| ----------------------------------- | --------------------------------- | ----------------------------- |
| Unique title among its siblings     | `Panel "Errors"`                  | `Row "Nodes"`                 |
| Title shared with a sibling         | `Panel "New panel" at position 2` | `Row "Backend" at position 2` |
| No title, the only untitled sibling | `Panel (unnamed)`                 | `Row (unnamed)`               |
| No title, other untitled siblings   | `Panel (unnamed) at position 3`   | `Row (unnamed) at position 3` |

A whitespace-only title counts as no title. Library panels are named the same way, from their `title`.

### Headers and references

| Where                                                  | Form                                                                                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel node header (the tree shows its section)         | the name above: `Panel "Errors"`, `Panel (unnamed) at position 3`                                                                                                                                                |
| Section node header                                    | its own segment, plus ` under <parent path>` when the tree doesn't show it right under its direct parent (see below): `Row "Backend" at position 2`, `Row "Nodes" under Tab "Cluster"`                           |
| `removed with it` (under the removed section's header) | the name above, from the baseline: `removed with it: Panel "New panel" at position 2`                                                                                                                            |
| System defaults owner (no tree context)                | the name above, plus `in <section path>` when the title isn't unique in the whole dashboard: `Panel "Errors" in Tab "DB"`, `Panel "New panel" at position 2` (root), `Panel (unnamed) at position 3 in Tab "DB"` |
| Move texts                                             | see §3                                                                                                                                                                                                           |

**Path compression.** A section with no changes of its own and no changed panels directly inside it is not
shown; its changed descendant sections take its place. A section with no own changes that directly contains a
changed panel is shown as a header only.

**The "under" rule.** A section header adds ` under <parent path>` (the full path of its direct parent,
segments joined with `›`) when its parent in the tree is not its direct parent: path compression hid an
intermediate section, or the parent isn't shown at all. It is dropped when the tree parent is the direct
parent, since the indentation already shows where it sits. Root-level sections never get it, and panels never
do (their section is always shown, or they sit at the root).

| Tree                                                                    | Header                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Row "Nodes"` shown as a child of the `Tab "Cluster"` node              | `Row "Nodes"`                                                                      |
| `Tab "Cluster"` not shown (no own changes)                              | `Row "Nodes" under Tab "Cluster"`                                                  |
| `Tab "Cluster"` shown, `Row "Nodes"` compressed, `Tab "Disk"` inside it | `Tab "Disk" under Tab "Cluster" › Row "Nodes"` (child of the `Tab "Cluster"` node) |

**Icons in the UI.** Wherever a panel, row or tab is named (node headers, move texts and their neighbours,
`removed with it`, System defaults owners), the UI shows the kind as an icon instead of the word, followed by
the quoted name: `↗"CPU"`, `≡"Nodes"`, `⧉"Cluster"`. Each icon carries the word as its aria-label. A header's
own name has no icon of its own, because the header's leading icon already shows it. Change lines and
before/after details stay plain text. The corpus shows every name with its word (`Row "Nodes"`), the header's
own name included. `the top level of the dashboard` stays text.

## 3. Node status texts

The header is the label, then (after a space) the status text, then `·` and the summary.

| Node                         | Header                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| added                        | `+ Added Panel "Saturation"`, `+ Added Row "New row" under Tab "Tab 1"` (no status text)                                                                                        |
| removed                      | `- Removed Tab "Tab 2"`, `- Removed Row "DB" under Tab "Tab 1"`                                                                                                                 |
| updated                      | `Panel "Errors" was updated (2 changes) · properties, data`; `Row "DB" under Tab "Tab 1" was updated (2 changes) · properties`; `Dashboard was updated (1 change) · properties` |
| moved                        | `Panel "Errors" moved after Panel "Latency"`                                                                                                                                    |
| moved and updated            | `Panel "Errors" moved after Panel "Latency" and was updated (1 change) · layout`                                                                                                |
| header only (no own changes) | `Row "DB"` (no status text, no summary)                                                                                                                                         |

Added and removed nodes of every kind (panels, rows, tabs) say so with a verb before the name, and keep the

- / − marker; the "under" rule applies to them too. `was updated (N changes)` counts the node's change lines
  (all categories), with i18n plurals (`1 change`, `2 changes`).

**Moves are stated relative to a neighbour** in the payload's reading order, among the node's siblings in
its (new) section:

| Situation                                | Status text                                                |
| ---------------------------------------- | ---------------------------------------------------------- |
| same section, has a preceding sibling    | `moved after Panel "Latency"`                              |
| same section, now first                  | `moved before Panel "Requests"` (the next sibling)         |
| changed section, has a preceding sibling | `moved from Tab "Tab 2" to Tab "Tab 1", after Panel "P2"`  |
| changed section, now first               | `moved from Row "API" to Row "DB", before Panel "Queries"` |
| changed section, alone in it             | `moved from Tab "Tab 2" to Tab "Tab 1"`                    |

The neighbour is named without a position: being next to the moved element identifies it. When the moved
element's own name is ambiguous, its header label has no position and the status text ends with its **new**
position: `Panel "New panel" moved before Panel "New panel", at position 1` (and, when also updated,
`…, at position 1, and was updated (1 change)`; across sections:
`…, after Panel "New panel", at position 2`). A move between sections names both ends, each as its full
section path (`moved from Tab "Overview" › Row "API" to Tab "Overview" › Row "DB", …`); the root reads
`the top level of the dashboard` (`moved from Row "API" to the top level of the dashboard`,
`moved from the top level of the dashboard to Row "API"`). Moves within a section name no ends
(`moved after Panel "P2"`). A moved node is listed under its new section. Sections move the same way: `Row "DB" moved before Row "API"`.

**Only real moves.** Within a section, a node is moved when it is outside the longest common subsequence of
the baseline and payload order of the siblings present on both sides, so neighbours that only shifted are
not moves. Ties: keep in the subsequence the nodes whose grid coordinates didn't change, then the ones that
come first in the baseline. A node whose coordinates changed while its reading order didn't is not moved; it
gets a Layout `Position` line (§7).

A removed section lists what was removed with it, one entry per panel or nested section, in baseline
reading order (depth-first): `removed with it: Panel "Queries"`.

An added section shows its panels as child nodes, each `+ Added Panel "…"` (or with a move text when an existing
panel was moved into it). An added or removed node lists no categories.

A layout change that puts existing panels or sections into a new section (grouping a grid into rows or tabs,
wrapping rows in a tab) doesn't mark them moved: the `Layout:` line accounts for them. The new section's header
counts them, naming the kind, and lists them one level deep in payload reading order, one `• ` line each:

```
+ Added Row "New row" (3 panels moved to it)
  • Panel "P1"
  • Panel "P2"
  • Panel "P4"
```

An added or removed element lists what it is set to, one `· ` line per property, under its header (in the UI,
behind its +/− toggle). Only what's set: empty values, `false` and schema or plugin defaults are left out. Literal
values follow the label (`· Description: "Cache hits"`, `· Multi-value: Yes`); lists and objects are JSON behind
Show, which the text marks `[Show]` (`· Queries (1) [Show]`). The title is the header's name and isn't repeated.
Every added or removed element is reviewable: when nothing differs from the defaults, the list shows what it is
set to, defaults and `No` included (a switch variable at its defaults), and `· No settings` when even that is
empty. A section whose toggle already reveals panels or moved-in elements doesn't list its defaults.

A rule set added or removed is one line with its rule count, its settings listed under it:
`Conditional rendering: added (1 rule)` then `· Panel visibility: Hide`, `· Match rules: Match all`,
`· Template variable "env": Equals "prod"`. A rule added to or removed from an existing set says so, and the category
label recalls how the rules combine, since that holds for the whole set: `[Conditional rendering (Match all)]` then
`+ Rule added: Time range less than 30 minutes`.

Several changed fields of one list item (a variable, a query, …) read as one line naming it, with the changes
indented under it and worded without the name:

```
Custom variable "env" (3 changes)
  Label: "Env" → "Environment"
  Include All option: turned on
  Description: set to "Where the service runs"
```

A moved-in element that also changed is not a bullet: its node is shown in the bullet's place. An added section's
header also counts its new direct children: `(4 panels moved to it, 1 panel added)`, or `(1 panel added)` alone.
A new section's layout is listed only when it isn't an auto grid.

The kind is `panels`, `rows` or `tabs`; `elements` if they were ever mixed. The entries are not counted as
changes. A panel moved in from a section that exists on both sides keeps its own move line instead. In the UI
the + is the toggle, and a section whose only content is this list starts collapsed.

When a section's own layout type changes (e.g. its auto grid becomes rows), its `Layout: changed from auto grid
to rows` line covers the panels the new sections take over: they are not listed as moved, and the new sections
holding them are `+ Added` with no panel children for them.

## 4. Collapsed summary (`summary`)

The labels of the node's non-empty categories, lowercase forms, in category display order, joined with
the locale's unit list (`Intl.ListFormat` `type: 'unit', style: 'short'` → `data, field config`).
Empty for nodes with no categories (added, removed, moved without other changes, header-only sections).

## 5. Overview line

`Changes to <list>` where `<list>` is the conjunction list (`Intl.ListFormat` `type: 'conjunction'`) of,
in this order and only when non-zero:

- `the dashboard` — the Dashboard node is in the tree;
- `1 row` / `<n> rows`, `1 tab` / `<n> tabs` — top-level sections holding a change at any depth (a change inside
  a tab is a change to the tab), including the section a panel moved out of;
- `1 panel` / `<n> panels` — top-level panels in the tree.

Examples: `Changes to the dashboard`, `Changes to 1 tab`, `Changes to the dashboard and 1 panel`,
`Changes to the dashboard, 2 rows, and 1 panel`. Empty when the tree is empty.

**New dashboard** (`mode: 'new'`): the UI intro already says "This creates a new dashboard with:", so the line
is the bare list with its first letter capitalized, same items and plurals: `The dashboard and 2 panels`,
`The dashboard, 1 section, and 2 panels`, `2 panels` (no dashboard node). Separate i18n keys, not a
capitalized fragment.

## 6. Change counts and kinds

Each `ReviewChange` has a kind: `added` when its text says added, `removed` when its text says removed,
otherwise `changed` (this includes `set to …`, `cleared …`, `turned on/off`, `Position: moved …`).
**New dashboard:** every change is `added` (the whole dashboard is new), so its counts read
`N added, 0 changed, 0 removed, 0 moved`; the texts themselves don't change (`Title: set to "Checkout"`).
`moved` is only used by node status. Counts = every change line in the tree + every node with a status
(once: an added node counts as added, a removed one as removed, a moved one as moved) + every Metadata line. System defaults are not counted. Panels in `removed with it` are not counted.

## 7. Value formatters

A **short value** is a string of at most 40 characters without a newline, a number, or a boolean. Arrays,
objects and longer strings are **long values**. Free-text fields (descriptions, subtitles) are short when
they are at most 60 characters on one line, and long otherwise.

| Case                 | Text                                                                                                          | Details       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------- |
| short → short        | `Min interval: 1m → 30s`                                                                                      | none          |
| (not set) → short    | `Max data points: set to 500`                                                                                 | none          |
| short → (not set)    | `Max data points: cleared (was 500)`                                                                          | none          |
| boolean, either side | `Transparent background: turned on` / `…: turned off` (by the new value; a removed `true` reads `turned off`) | none          |
| long → long          | `Thresholds: changed`                                                                                         | before, after |
| (not set) → long     | `Description: added`                                                                                          | after         |
| long → (not set)     | `Description: removed`                                                                                        | before        |
| short ↔ long        | `Description: changed`                                                                                        | before, after |

This is the only phrasing, everywhere (tree and System defaults): booleans always read `turned on` /
`turned off` (never `set to off`), short values `set to X` / `cleared (was X)` / `X → Y`. Examples:
`Description: set to "Golden signals"`, `Description: cleared (was "Golden signals")`.

**Text values are in double quotes.** When a change sets, renames or clears a free-text value (one typed into
a text box), its inline values are quoted: `Title: "Requests" → "Request rate"`, `Title: set to "Checkout"`,
`Title: cleared (was "Requests")`, `Display name: set to "Errors"`. Free text is:

- spec fields: dashboard `title`, `description`; panel and library panel `title`, `description`, `subtitle`;
  row and tab `title`; library panel `name` (`Library panel: "Shared errors" → "Shared latency"`); panel and
  dashboard link `url`, `tooltip`; variable `label`, `description`, `regex`, `allValue`, `placeholder`, and the
  `query` of custom, text and constant variables; the query body's `legendFormat`;
- plugin options and field config (defaults and override properties) whose editor is a text input: an options
  builder item added with `addTextInput` (editor id `text`, including `textarea` settings), or a field config
  registry item with editor id `text` (standard: `displayName`, `noValue`, `description`; custom ones such as
  `custom.axisLabel`). Without the plugin, only the standard ones are known (from
  `standardFieldConfigEditorRegistry`); other values are shown raw.

Never quoted: choices and enums, units, numbers, booleans, durations and time ranges, colors, variable names
used as references (`Repeat by variable: set to env`), query text (code, shown as is), metadata values, and
any value inside details. Names in element labels are always quoted (§2).

"Not set" means absent, `''`, or an empty array/object. Going between two "not set" forms (e.g. `''` →
absent) is no change: it shows nothing anywhere (claimed as bookkeeping). Titles and names are always short
(shown inline, however long). Details are the value as is when it is a string, otherwise
`JSON.stringify(value, null, 2)` (keys as stored, i.e. sorted); a side that is not set is omitted, never the
text `undefined`.

**Option values** (plugin options, field config defaults and override properties) are shown with the panel
editor's words when the plugin is loaded:

- an option with choices (select, radio) shows the choice's label: `Legend › Mode: List → Table`,
  `Legend › Placement: set to Right`, `Tooltip › Values sort order: set to None`;
- a unit shows its display name from the value formats registry: `Standard options › Unit: Number → Percent (0-100)`;
- an unknown value (no matching choice or unit), or no plugin loaded, shows the raw value:
  `Legend › Display mode: list → table`.

Special formatters:

| Field                                                                    | Text                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default time range (`from` + `to`, one line, claims both)                | `Default time range: Last 6 hours → Last 24 hours` via `rangeUtil.describeTimeRange({ from, to })`                                                                                                                                                                   |
| Auto refresh (`autoRefresh`)                                             | `''` reads `Off`: `Auto refresh: Off → 1m`                                                                                                                                                                                                                           |
| Graph tooltip (`cursorSync`)                                             | `Off` → `Default`, `Crosshair` → `Shared crosshair`, `Tooltip` → `Shared tooltip`                                                                                                                                                                                    |
| Editable (`editable`)                                                    | boolean: `Editable: turned off`                                                                                                                                                                                                                                      |
| Layout type                                                              | `Layout: changed from rows to tabs`; kinds read `custom grid` (GridLayout), `auto grid` (AutoGridLayout), `rows`, `tabs`                                                                                                                                             |
| Default grid (`preferences.layout` kind)                                 | `Default grid: Custom grid → Auto grid`; other changes inside it: `Default grid: changed` + details                                                                                                                                                                  |
| Row collapse (`collapse`)                                                | `Row: collapsed` / `Row: expanded`                                                                                                                                                                                                                                   |
| Visualization (`vizConfig.group`)                                        | `Visualization: Time series → Stat` (plugin `meta.name` when loaded, else the plugin id)                                                                                                                                                                             |
| Panel position (grid `x`/`y`, one line, claims both)                     | Only when the reading order didn't change (otherwise the node is moved, §3): `Position: moved right`, `moved down`, `moved down and left` (vertical first; by the sign of Δy, Δx)                                                                                    |
| Panel size (grid `width`/`height`, one line, claims both)                | In words, width first, joined with the conjunction list: `Size: wider`, `narrower`, `taller`, `shorter`, `Size: wider and taller`; details: before `12 × 8`, after `24 × 8` (width × height)                                                                         |
| Thresholds (field config `thresholds`, defaults or an override property) | `Thresholds: changed`; details are readable steps, one per line, in stored order: the first step is `Base: <color>`, the others `<value>: <color>` (`80: red`); when the mode differs between the sides, each side starts with `Mode: Absolute` / `Mode: Percentage` |
| Variable type (`kind`)                                                   | `Type: Custom → Query` (kind without `Variable`, humanized: `Ad hoc filters`, `Group by`, `Data source`, `Interval`, `Text box`, `Constant`, `Switch`)                                                                                                               |

**Visualization type changes** (`vizConfig.group`):

- The placeholder `__unconfigured-panel` (a new panel no one has picked a visualization for) is "not set":
  `Visualization: set to Gauge`, never `__unconfigured-panel → Gauge`.
- The plugin version change that comes with it is part of the Visualization line.
- Option and field config values the old plugin had and the payload dropped are part of the Visualization
  line too: they belonged to the old visualization.
- Values equal to the new plugin's defaults go to System defaults when the new plugin is loaded (§10).
- Every other option and field config value stays in the tree as its own line, with the new plugin's
  labels (or humanized labels when it isn't loaded), e.g. `Stat styles › Color mode: set to Background Gradient`.

**Color scheme** (field config `color`, and `color` override properties): the value reads as the color
mode's name from `fieldColorModeRegistry` (`From thresholds`, `Classic palette`, `Single color`, …; a fixed
color adds it: `Single color (red)`), whether or not the panel plugin is loaded; an unknown mode reads raw.

### Settings where "absent" is a value

The auto grid serializer writes a setting only when it differs from its default, so a missing key is read
as that default, never as "not set":

| Setting                           | Absent means      | Text                                                                                                                    |
| --------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| layout `matchRowHeights`          | on                | `false` → absent: `Match row heights: turned on`; absent → `false`: `turned off`                                        |
| layout `fillScreen`, `fitContent` | off               | absent → `true`: `Fill screen: turned on`; `true` → absent: `turned off`                                                |
| item `fitContent`                 | follow the layout | absent → `true`/`false`: `Fit content: turned on` / `turned off`; set → absent: `Fit content: set to follow the layout` |

An empty description (`''`) and an absent one are the same ("not set"): going from one to the other is no
change and shows nothing. A cleared short description reads `Description: cleared (was …)`; a cleared long
or multi-line one reads `Description: removed` (details: before only).

Layout kinds that Review doesn't know are named from their kind, humanized: `FancyLayout` →
`Fancy layout` (`Layout: changed from custom grid to Fancy layout`).

### Show / hide rules

The category and the whole-set line are named "Conditional rendering". With a single rule the visibility line uses the editor label (`Panel visibility: Show → Hide`); with several rules it says it applies when they match (`Panel visibility when the rules match: Show → Hide`), so it doesn't read as the panel being hidden outright.

`conditionalRendering` on rows, tabs and auto grid panels uses the show / hide rules editor's words. Lines
go to the Conditional rendering category, for sections and panels alike. `<Type>` is `Row`, `Tab` or `Panel`.

| Part            | Label                            | Values                                                                                                                                                           |
| --------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visibility`    | `<Type> visibility`              | `Show`, `Hide`                                                                                                                                                   |
| `condition`     | `Match rules`                    | `and` → `Match all`, `or` → `Match any`                                                                                                                          |
| variable rule   | `Template variable "<variable>"` | operator `Equals`, `Not equals`, `Matches`, `Not matches`, then the value in double quotes: `Equals "prod"`                                                      |
| data rule       | `Query result`                   | `Has data` (`true`), `No data` (`false`)                                                                                                                         |
| time range rule | `Time range less than`           | the editor's labels: `5 minutes`, `15 minutes`, `30 minutes`, `1 hour`, `3 hours`, `6 hours`, `12 hours`, `24 hours`, `2 days`, `7 days`, …; any other value raw |

Rules are identified by kind plus variable name (data and time range rules by kind, then occurrence),
never by index, and listed in payload order (a removed rule right after its baseline predecessor).
Every line about a single rule has `subject: 'rule'`. A rule's element text is its label and value
separated by a space: `Template variable "cluster" Equals "blue"`, `Time range less than 7 days`,
`Query result Has data`.

| Change                        | Text                                                                                                         | Kind    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| visibility changed            | `Row visibility: Show → Hide` (several rules: `Row visibility when the rules match: …`)                      | changed |
| condition changed             | `Match rules: Match all → Match any`                                                                         | changed |
| rule changed (subject `rule`) | `Template variable "env": Equals "prod" → Matches "prod\|staging"`, `Time range less than: 1 hour → 3 hours` | changed |
| rule added                    | `+ Template variable "cluster" Equals "blue"` (subject `rule`)                                               | added   |
| rule removed                  | `- Template variable "region" Equals "eu-west"` (subject `rule`)                                             | removed |
| whole rule set added          | `Conditional rendering: added`, details after (below)                                                        | added   |
| whole rule set removed        | `Conditional rendering: removed`, details before                                                             | removed |

Details of a whole rule set are readable lines, never JSON: the visibility, the match rules, then one line
per rule, e.g. `Row visibility when the rules match: Show` / `Match rules: Match all` / `Template variable "env": Equals "prod"`.

### Library panels

| Change               | Text (Properties)                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Panel → LibraryPanel | `Converted to library panel "Shared errors"` (claims the kind change and every diff it implies) |
| LibraryPanel → Panel | `Unlinked from library panel "Shared errors"`                                                   |
| other library panel  | `Library panel: "Shared errors" → "Shared latency"`                                             |

## 8. Named list items

Items are matched by identity, never by index. Index-shift noise (an insert or remove moving the other
items) is claimed by the add/remove that caused it and shows nothing for unchanged items.

| List                        | Identity                       | Item name                                                                                                                                                                                                                                                      | `subject`                   |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| queries                     | `refId`                        | `Query "A"`                                                                                                                                                                                                                                                    | `query`                     |
| transformations             | transformation id + occurrence | `Transformation "Organize fields by name"` (registry name, else the id); the same id more than once: `Transformation "Filter by name" (2nd)`                                                                                                                   | `transformation`            |
| variables                   | `name`                         | by type, as the variable editor names it: `Query variable "env"`, `Custom variable "env"`, `Group by variable "by"`, `Data source variable`, `Interval variable`, `Text box variable`, `Constant variable`, `Switch variable` (unknown kind: `Variable "env"`) | `variable`                  |
| ad hoc filters              | `name`                         | `Ad hoc filters "filters"`                                                                                                                                                                                                                                     | `adHocFilter`               |
| annotations                 | `name`                         | `Annotation "Deploys"`                                                                                                                                                                                                                                         | `annotation`                |
| links (dashboard and panel) | `title`                        | `Link "Runbook"`                                                                                                                                                                                                                                               | `link`                      |
| overrides                   | matcher (id + options)         | `Override "errors"` (matcher options when a string, else the humanized matcher id)                                                                                                                                                                             | `override`                  |
| override properties         | property `id`                  | field config label (see §9), inside its override's line                                                                                                                                                                                                        | `override` (the override's) |
| tags                        | value                          | `Tag "prod"`                                                                                                                                                                                                                                                   | `tag`                       |

Every line about one of these items carries its `subject`, whatever its kind. `tag`, `override` and `rule`
have no icon in the UI, only the + / − marker.

| Change                               | Text                                                                                                     | Details                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| added                                | `+ Query "B"`, `+ Tag "slo"`, `+ Override "latency"` (text is the name, kind added)                      | variables, ad hoc filters, annotations and links: after = the item as JSON (variables without `options`, their resolved values) |
| removed                              | `- Custom variable "region"`, `- Tag "staging"`                                                          | variables, ad hoc filters, annotations and links: before = the item as JSON                                                     |
| a field of the item changed          | `Custom variable "env" › Label: "Env" → "Environment"`, `Override "errors" › Standard options › Unit: …` | per §7                                                                                                                          |
| relative order of kept items changed | `Query order: changed`, `Variable order: changed`, `Tag order: changed`, …                               | before, after: the names, one per line                                                                                          |

Items are listed in payload order; a removed item is placed right after the item that preceded it in the
baseline.

Item fields:

- **Query:** each key of the query body (`query.spec`) is a field, long or short per §7. The common
  query-text keys `expr`, `query`, `rawSql`, `rawQuery`, `queryText` and `expression` are labelled
  `Query text` (`Query A › Query text: changed`); other keys are humanized (`legendFormat` → `Legend format`). `query.datasource.name` and
  `query.group` together: `Data source: <before name or group> → <after name or group>`. `hidden`:
  `Hide response`.
- **Transformation:** each key of `spec.options` (humanized), `spec.disabled` → `Disabled`,
  `spec.filter` → `Filter`, `spec.topic` → `Applies to`.
- **Override:** each property by its field config label; the matcher is the identity.
- **Variable:** `label` Label, `description` Description, `hide` Display, `query` Query, `regex` Regex,
  `sort` Sort, `refresh` Refresh, `multi` Multi-value, `includeAll` Include All option, `allValue` Custom all
  value, `current` Current value, `options` Options, `datasource` Data source, `allowCustomValue` Allow custom
  values, `skipUrlSync` Skip URL sync; anything else humanized.
- **Annotation:** `enable` Enabled, `hide` Hidden, `iconColor` Color, `query` Query, `filter` Show in;
  anything else humanized.
- **Link:** `url` URL, `tooltip` Tooltip, `icon` Icon, `type` Type, `tags` Tags, `asDropdown` Show as dropdown,
  `targetBlank` Open in new tab, `includeVars` Include current template variable values, `keepTime` Include
  current time range, `placement` Placement.

## 9. Field labels

### Dashboard

| Path                                                                        | Category   | Label                                                          |
| --------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `title`                                                                     | Properties | Title                                                          |
| `description`                                                               | Properties | Description                                                    |
| `tags`                                                                      | Properties | Tag items (§8)                                                 |
| `editable`                                                                  | Properties | Editable                                                       |
| `preload`                                                                   | Properties | Preload panels                                                 |
| `liveNow`                                                                   | Properties | Refresh live dashboards                                        |
| `cursorSync`                                                                | Properties | Graph tooltip                                                  |
| `layout.kind`                                                               | Layout     | Layout (special formatter)                                     |
| section order                                                               | —          | moved sections (§3)                                            |
| `preferences.layout`                                                        | Layout     | Default grid                                                   |
| root auto grid `maxColumnCount`                                             | Layout     | Max columns                                                    |
| root auto grid `columnWidthMode` / `columnWidth`                            | Layout     | Column width / Custom column width                             |
| root auto grid `rowHeightMode` / `rowHeight`                                | Layout     | Row height / Custom row height                                 |
| root auto grid `minHeightMode` / `minHeight`, `maxHeightMode` / `maxHeight` | Layout     | Min height / Custom min height, Max height / Custom max height |
| root auto grid `fillScreen`                                                 | Layout     | Fill screen                                                    |
| root auto grid `fitContent`                                                 | Layout     | Fit content                                                    |
| root auto grid `matchRowHeights`                                            | Layout     | Match row heights                                              |
| `variables`                                                                 | Controls   | Variable items (§8)                                            |
| `annotations`                                                               | Controls   | Annotation items (§8)                                          |
| `links`                                                                     | Controls   | Link items (§8)                                                |
| `timeSettings.from` + `to`                                                  | Controls   | Default time range                                             |
| `timeSettings.timezone`                                                     | Controls   | Time zone                                                      |
| `timeSettings.weekStart`                                                    | Controls   | Week start                                                     |
| `timeSettings.autoRefresh`                                                  | Controls   | Auto refresh                                                   |
| `timeSettings.autoRefreshIntervals`                                         | Controls   | Auto refresh intervals                                         |
| `timeSettings.nowDelay`                                                     | Controls   | Now delay                                                      |
| `timeSettings.hideTimepicker`                                               | Controls   | Hide time picker                                               |
| `timeSettings.quickRanges`                                                  | Controls   | Quick ranges                                                   |
| `timeSettings.fiscalYearStartMonth`                                         | Controls   | Fiscal year start month                                        |
| `revision`                                                                  | —          | bookkeeping (§11)                                              |

Field order inside a category is the order of this table. Controls: variables, annotations, links, then
time settings.

### Section (row or tab)

| Field                  | Category              | Label                                                                  |
| ---------------------- | --------------------- | ---------------------------------------------------------------------- |
| `title`                | Properties            | Title                                                                  |
| `hideHeader`           | Properties            | Hide row header                                                        |
| `fillScreen`           | Properties            | Fill screen                                                            |
| `repeat`               | Repeat                | Repeat by variable (`set to env`, `env → region`, `cleared (was env)`) |
| `collapse`             | Conditional rendering | Row (special formatter)                                                |
| `conditionalRendering` | Conditional rendering | Show / hide rules (§7)                                                 |
| `variables`            | Controls              | Variable items (§8)                                                    |
| `annotations`          | Controls              | Annotation items (§8)                                                  |

### Panel

| Path                                    | Category              | Label                                                                                           |
| --------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `spec.title`                            | Properties            | Title                                                                                           |
| `spec.description`                      | Properties            | Description (free text)                                                                         |
| `spec.subtitle`                         | Properties            | Subtitle (free text)                                                                            |
| `spec.links`                            | Properties            | Link items (§8)                                                                                 |
| `spec.transparent`                      | Properties            | Transparent background                                                                          |
| library panel                           | Properties            | see §7                                                                                          |
| layout item position / size             | Layout                | Position / Size (special formatters); a changed reading order is a move (§3)                    |
| layout item `repeat.value`              | Layout                | Repeat by variable                                                                              |
| layout item `repeat.direction`          | Layout                | Repeat direction (`h` → `horizontal`, `v` → `vertical`)                                         |
| layout item `repeat.maxPerRow`          | Layout                | Max per row                                                                                     |
| auto grid item `conditionalRendering`   | Conditional rendering | Show / hide rules (§7), same lines as sections (`Panel visibility when the rules match: …`)     |
| auto grid item `fitContent`             | Layout                | Fit content                                                                                     |
| `data.spec.queries`                     | Data                  | Query items (§8)                                                                                |
| `data.spec.transformations`             | Data                  | Transformation items (§8)                                                                       |
| `queryOptions.maxDataPoints`            | Data                  | Max data points                                                                                 |
| `queryOptions.interval`                 | Data                  | Min interval                                                                                    |
| `queryOptions.timeFrom`                 | Data                  | Relative time                                                                                   |
| `queryOptions.timeShift`                | Data                  | Time shift                                                                                      |
| `queryOptions.timeCompare`              | Data                  | Time comparison                                                                                 |
| `queryOptions.hideTimeOverride`         | Data                  | Hide time info                                                                                  |
| `queryOptions.cacheTimeout`             | Data                  | Cache timeout                                                                                   |
| `queryOptions.queryCachingTTL`          | Data                  | Cache TTL                                                                                       |
| `queryOptions.<other>`                  | Data                  | humanized                                                                                       |
| `vizConfig.group`                       | Visualization         | Visualization                                                                                   |
| `vizConfig.version`                     | —                     | always a system default (§10); with a visualization type change, part of the Visualization line |
| `vizConfig.spec.options.*`              | Plugin options        | plugin label, else humanized path                                                               |
| `vizConfig.spec.fieldConfig.defaults.*` | Field config          | field config label, else humanized path                                                         |
| `vizConfig.spec.fieldConfig.overrides`  | Field config          | Override items (§8)                                                                             |
| `spec.id`                               | —                     | bookkeeping (§11)                                                                               |

Data order: queries, transformations, query options (in the order above). Plugin options and field config
defaults: in the order the panel editor lists them; labels the plugin doesn't know come after, by path.
Field config overrides come after the defaults.

**Plugin option label:** the editor item's category path and name: `Legend › Mode`
(`legend.displayMode`). An item without a category uses the plugin's `meta.name` as its category. When the
name equals the last category segment, it is not repeated.

**Field config label:** the longest `fieldConfigRegistry` id that prefixes the path; label = category path
and name: `Standard options › Unit`, `Graph styles › Line width`, `Thresholds` (name equals the category).

**Humanized fallback** (no plugin loaded, or no label): split the path at `.`, split camelCase into words,
capitalize the first word of each segment, join with `›`: `legend.displayMode` → `Legend › Display mode`,
`tooltip.hideZeros` → `Tooltip › Hide zeros`. Field config fallback drops a leading `custom`
(`custom.lineWidth` → `Line width`). Array indexes are never shown: a change inside an array is a change of
the array (long value).

## 10. System defaults

Section header `System defaults (<n>)`; one group per owner (`Dashboard` or the panel label, e.g.
`Panel "Requests"`); lines:

| Value                        | Text                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| plugin version filled in     | `Plugin version: set to 11.0.0`                                                                                                          |
| plugin version bumped        | `Plugin version: 13.3.0 → 13.4.0`                                                                                                        |
| new visualization's defaults | one line per category: `Plugin options: set to the Gauge defaults`, `Field config: set to the Gauge defaults` (the plugin's `meta.name`) |
| boolean                      | `Hide response: turned off` / `turned on`                                                                                                |
| other short value            | `<label>: set to <value>` (option values per §7)                                                                                         |
| long value                   | `<label>: added` (details: after)                                                                                                        |

An empty value (`''`, `[]`, `{}`) for a key the baseline doesn't have is not listed at all (§7).

Lines in a group follow the owner's category and field order (as in the tree).

A diff is a system default only when the baseline has no value at that path and the payload's value is the
default Grafana fills in: the loaded plugin's option / field config default (after a visualization change
this includes the color mode `getPanelOptionsWithDefaults` picks for the new plugin, e.g. `thresholds` for
gauge and stat; a threshold base step's value is ignored, it always means −∞), the schema default, or
`false` for a key the baseline doesn't have. Every `vizConfig.version` change is a system default: filled
in (`''` → a version) or bumped by an upgrade (both set, plugin type unchanged). When the plugin type
changes too, the version change belongs to the panel's Visualization line instead. Anything else, including a value that differs from the default,
a value changed _to_ the default, and any add while the plugin isn't loaded (unless it is `false`), is a
user change.

## 11. Bookkeeping (claimed, never shown)

| Path                                              | Why                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revision`                                        | Version stamp of dashboards installed by a plugin; set by the plugin installer, not editable in the UI.                                              |
| `elements/<name>/spec/id` (element on both sides) | Internal numeric panel id, reassigned by Grafana (duplicate, paste, import); the user never sets it and the panel is identified by its element name. |

Not bookkeeping: `kind` changes (they change what an item is), override `__systemRef` (part of an override
the user created through the legend), query `version` (a system default when filled in).

## 12. Metadata

| Change               | Text                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| folder               | `Folder: General → Ops` (titles as given; a missing title reads `Dashboards`)    |
| predefined variables | `Predefined variables: None → All / All` (labels as given; missing reads `None`) |

Both are kind `changed` and claim nothing.

## 13. Fixed texts elsewhere (from the plan)

`No changes to save`, `No changes to the dashboard content. Expand the sections below to see what else will
be saved.`, `This creates a new dashboard with:`, `This saves a copy of "{{title}}". The original dashboard
isn't changed. Differences from the original:`, `Values Grafana filled in automatically. You didn't edit
them.`, `Summarizing changes…`, `Unable to summarize changes`, `See the technical diff in Changes`.
