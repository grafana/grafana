# Dashboard change review plan

Status: phase 1 implemented on branch `grafakus/human-friendly-diffs`, behind
the feature toggle `grafana.humanFriendlyDashDiffs`; the product owner's
feedback rounds are being worked through. See
[Implementation status](#implementation-status) and
[Team and working process](#team-and-working-process) to resume.
Agreed on: 2026-11-04. Revised on: 2026-11-05 after code review, a design pass
on the Review layout, the names-with-icons plan (PLAN-ICON-NAMES.md, folded in
below), and 27 rounds of product owner feedback during implementation.

Where the wording in this plan and
`public/app/features/dashboard-scene/saving/review/__corpus__/WORDING.md`
disagree, WORDING.md wins: it is the up-to-date wording specification, and the
example corpus enforces it.

## Purpose and audience

Help dashboard editors understand the meaningful changes they are about to save,
whether those changes came from the user, an assistant, or both. Understanding the
overview must not require reading dashboard JSON or knowing every query language.

Think of Review as a human-friendly JSON diff: it covers the same differences as
the technical diff, but it is organized the way people think about a dashboard
and worded the way people talk about it. Optimize for humans first, and for
scannability in particular.

The first version is a prototype. It promises a complete overview of what
changed. It does not validate the edits or explain every change's behavioral
consequences. Users can inspect the existing technical diff when they need deeper
detail.

## Scope

- **Dashboards:** v2 dashboards only. Review is available when both the baseline
  and the save payload are v2 specs. Classic (v1) dashboards, and v1 dashboards
  that are migrated to v2 during editing (`hasMigratedToV2`), don't get a Review
  tab.
- **Save flows:** a normal save of an existing dashboard, the first save of a
  brand-new dashboard, and Save As copy.
- **Not covered:** Save as template, Save template, saves to a provisioning
  repository (`SaveProvisionedDashboard`), and managed resources that can't be
  edited.

## Agreed design

The experience lives inside the save drawer. Keep the existing tabs and add a
separate Review tab, producing three tabs in total:

| Tab | Purpose |
| --- | --- |
| Details | Default tab; configure the save and save the dashboard. |
| Review | New, optional human-friendly overview of changes. |
| Changes | Existing technical diff, retained for detailed inspection. |

Review follows the same visibility rule as Changes: it is shown when there is at
least one change or while it is the active tab, and it is hidden for managed
resources that can't be edited. It is also hidden outside the scope above. Do not
automatically open Review or require users to visit it before saving.

Review is read-only and has a “Back to details” action. It does not offer Save;
users return to Details to save. Users who want to modify their edits can leave
the drawer and resume editing. There is no selective acceptance or revert within
Review in the first version.

## Information design

Follow Shneiderman's mantra: overview first, then zoom and filter, then details
on demand. The first version covers overview, zoom, and details on demand;
filtering comes later (see [Later: filters](#later-filters)).

### Principles for every decision

These come from the product owner and apply to every change to Review, now and
later. When a formatting or structure choice is open, they decide it.

- **Understood at a glance, in natural language.** The goal of the feature is
  that a person grasps what they are about to save without reading JSON. Prefer
  the editor's words over spec keys, say what something is and where it went,
  and never leave an element without a way to see what it holds.
- **Progressive disclosure.** Each element gets one line that says what
  happened; detail sits one click deeper, never inline by default:
  - an element with several changed fields is one line with a count,
    `Query variable "number" (8 changes)`, its changes behind a chevron,
    worded without repeating the name;
  - an added or removed element is `+ Added "New panel"`, its +/− the toggle
    that lists what it is set to;
  - a rule set added or removed is `Conditional rendering: added (1 rule)`,
    its visibility, match logic and rules behind a chevron;
  - inside any list, literal values sit inline and lists or objects wait
    behind Show.
- **Every added or removed element is reviewable.** Its toggle always lists
  something: what is set beyond the defaults, or, when nothing is, what it is
  set to (defaults included), or "No settings". Tags and single rules are the
  exception: their line already says everything.

### Overview first

The top of Review answers “how much changed, and where?” at a glance:

- A one-line summary naming the top-level elements that hold changes, for
  example “Changes to the dashboard and 2 rows” or “Changes to 1 tab”: a change
  inside a tab is a change to the tab.
- Change-type counts (added, changed, removed, moved) as plain text, “added”
  and “removed” with the same green + and red − that mark items in the tree.

### Zoom

- **Hierarchy:** changes are grouped by concern, following the dashboard's own
  structure: the dashboard, then its sections (rows and tabs), then the panels
  inside each section. See [Change tree](#change-tree).
- **Collapsible nodes:** every section and panel node with content can be
  collapsed. Each node header names the node and, when collapsed, adds a
  one-line summary of the categories that changed (for example “CPU usage ·
  data, field config”). The indentation shows where a node sits; a header adds
  `under <path>` only when the tree skips sections in between (see
  [Naming items](#naming-items)).
- **Default expansion:** small edits start fully expanded. Above a threshold
  (starting point: 10 changed panels), panel nodes start collapsed, showing their
  one-line summaries. This is a display default, not a cutoff: nothing is hidden.
- **Expand and collapse:** “Expand all” and “Collapse all” actions are
  available.

### Details on demand

- Each change states what it was and what it is now: “Unit: none → percent”.
- Values that are long or structured (a query, a threshold list, a JSON blob)
  show “changed” with a “Show” toggle that reveals the before and after values
  inline.
- An added or removed element's +/− toggle lists what it is set to; an
  element with several changed fields is one line whose chevron lists them.
  See [Principles](#principles-for-every-decision).
- The Changes tab remains the place for the exact JSON.

### Review layout

1. **Overview:** summary line, change-type counts, expand and collapse actions.
2. **Change tree:** Dashboard node first, then section nodes, each containing
   its panel nodes.
3. **Metadata** (collapsible, collapsed by default): changes that are saved
   outside the dashboard spec: the folder move and the predefined variables
   annotation.
4. **System defaults** (collapsible, collapsed by default): values Grafana fills
   in automatically rather than the user editing them, such as plugin versions
   and panel option defaults added as panel plugins load. See
   [System defaults](#system-defaults).

Each collapsible section shows a count in its header, for example
“Metadata (1)”, and is omitted when it has no entries.

### Wording

Use these strings, all through the in-house i18n API (`t`, `<Trans />`):

| State | Wording |
| --- | --- |
| Nothing to save | “No changes to save” (reuse the Changes tab's `dashboard.review.no-changes` key) |
| Only metadata or system defaults changed | “No changes to the dashboard content. Expand the sections below to see what else will be saved.” |
| New dashboard intro | “This creates a new dashboard with:” |
| Save As copy intro | “This saves a copy of ‘{{title}}’. The original dashboard isn't changed. Differences from the original:” |
| System defaults note | “Values Grafana filled in automatically. You didn't edit them.” |
| Loading | “Summarizing changes…” |
| Summary failure | “Unable to summarize changes” with “See the technical diff in Changes” as a link to the Changes tab |

## Comparison semantics

- **Baseline:** use the same baseline as the Changes tab: the serializer's
  initial save model. That is the last loaded or saved version of the dashboard
  (`setInitialSaveModel`, `onSaveComplete`), not the moment the user entered edit
  mode. While a dashboard previews a pending change, `markPendingChangesRecorded`
  moves this baseline to the recorded pending change; verify during
  implementation whether the save drawer can open in that state, and if it can,
  label the baseline accordingly.
- **Payload:** compare against the payload that will actually be sent:
  - Normal save: `changedSaveModel` from `getDashboardChanges`, after save
    options are applied.
  - Save As copy: the `getSaveAsModel` result built from the Details form's
    title, description, and copy-tags values. This differs from what the Changes
    tab shows today, which compares the unmodified save model.
- Show net changes only. Edits that were subsequently undone disappear from the
  summary; intermediate assistant attempts and editing history are not listed.
- Explain final changes regardless of author. Do not require attribution data or
  attach human/assistant authorship to individual changes.
- Respect all three save options: time range (`saveTimeRange`), variable values
  (`saveVariables`), and refresh (`saveRefresh`). Update the summary when those
  options change in Details.
- Exclude internal bookkeeping from the user-facing summary. Every other
  persisted difference must appear in the change tree, Metadata, or System
  defaults; see [Completeness](#completeness).
- For a brand-new dashboard, explain that it is a new dashboard and describe what
  will be created as additions. Do not use an arbitrary editing-start snapshot
  that would hide some of its contents.
- For Save As copy, compare the copy with its source dashboard's baseline and
  open with the Save As copy intro. Unsaved edits to the source appear as
  differences, along with the new title, description, and any dropped tags.
- Concurrent changes by another editor are a separate conflict concern. This
  feature does not introduce conflict detection or merge behavior and does not
  claim to compare against a freshly fetched server version.

## Change tree

### Structure

The tree has three kinds of node. Only nodes with changes appear; a section
that contains a changed panel but has no changes of its own appears as a header
only, to give the panel its context.

| Node | Categories, in display order |
| --- | --- |
| Dashboard | Properties (title, description, tags, editable, preload, live now, cursor sync); Layout (layout type, section order); Controls (variables, ad hoc filters, group by, annotations, links, time picker and refresh) |
| Section (row or tab) | Properties (title, header visibility); Repeat; Show/hide (collapse, conditional rendering); Controls (the section's own variables and annotations) |
| Panel | Properties (title, description, subtitle, links, transparency); Layout (position, size, repeat); Conditional rendering (show/hide rules from its layout item); Data (queries, transformations, query options); Visualization (plugin type); Plugin options (`vizConfig.options`); Field config (defaults and overrides) |

Sections nest without limit: rows and tabs can contain each other at any depth,
regardless of what the layout managers allow today. Sections without changes of
their own and without a changed panel directly inside are left out of the tree
(path compression); a node whose direct parent was left out names its full
parent path with `under`, so the tree stays readable at any depth.

### Structural changes

- **Added** items are prefixed with a green + marker, and node headers say so:
  `Added "New row"`. A new panel or section doesn't list its every setting; its
  header is enough, with details on demand.
- **Removed** items are prefixed with a red − marker, and node headers read
  `Removed "Tab 2"` (“Removed”, not “Deleted”, to match the counts and the
  “Removed with it” list). A removed section has a collapsible list of the
  panels and nested sections removed with it.
- On an added or removed node with content, the +/− marker is the toggle in
  place of the chevron.
- **Moved** panels and sections are listed under their new section and say
  where they now sit relative to a neighbour: `Panel "P3" moved after Panel
  "P2"`; when the section changed, also where from and to: `Panel "P3" moved
  from Tab "Tab 2" to Tab "Tab 1", after Panel "P2"`. Only items outside the
  longest common subsequence of the old and new order count as moved.
- **Updated** nodes say so in their header: `Panel "Latency" was updated
  (3 changes)`.
- **Restructures:** when the layout type changes (for example from rows to
  tabs), show one Layout entry on the layout's owner, “changed from rows to
  tabs”, instead of a move entry for every panel. A new section the restructure
  filled with existing elements counts them in its header, `Added "New row"
  (3 panels moved to it)`, and lists them one level deep, so the review still
  says where they went.

### Identity

- **Panels** are matched by their element name in `elements`. A panel's section
  comes from the layout item that references it.
- **Sections** (rows and tabs) have no stable identifier in the v2 spec, so
  match them deterministically, in this order: same title at the same parent
  path; otherwise same position under the same parent when most of their panels
  are the same, which makes it a title change; otherwise a removal plus an
  addition.

### Naming items

Name items the way a person would point at them: element type first, then the
title in double quotes. Panels, rows and tabs show their type as the content
outline's icon instead of the word (panel `chart-line`, row `list-ul`, tab
`layers`); other items keep the word: `Query variable "env"`, `Query "A"`.
Below, `↗` stands for the panel icon, `≡` for the row icon and `⧉` for the tab
icon.

- **Where icons replace the word:** everywhere a panel, row or tab is named:
  node headers; move texts, including the source, the destination and the
  after/before neighbour (`moved from ⧉"Tab 2" to ⧉"Tab 1", after ↗"P2"`); the
  “Removed with it” and “moved to it” lists; and System defaults owner
  headings (`↗"CPU" in ⧉"A" › ≡"B"`). Change lines (`Title: "Nodes" →
  "Hosts"`) and before/after details stay plain text, and so does “the top
  level of the dashboard”.
- **The leading icon appears once:** a header starts with its node's icon and
  doesn't repeat it before the name: `+ ≡ Added "New row" under ⧉"Tab 1"`.
- **Headers:** `Added {name}` and `Removed {name}` for added and removed panels
  and sections; the bare name for updated or moved ones, followed by the status
  (`≡ "DB" was updated (2 changes)`).
- **“under”:** a section header adds `under <full parent path>` (joined with
  `›`) only when its parent in the tree isn't its direct parent, because path
  compression hid sections in between: `Added "New row" under ⧉"Tab 1" ›
  ≡"Row A"`. Root-level sections and panels never get it.
- **Untitled and ambiguous names:** untitled items read `(unnamed)`. When a
  name is ambiguous among its siblings (a shared title, or several untitled
  siblings), add its 1-based position in reading order: `↗"New panel" at
  position 2`. Removed items use their baseline position. Where no tree shows
  the section (System defaults), add it: `↗"Errors" at position 2 in ⧉"DB"`.
- **Screen readers** hear the word: each icon in a name has the aria-label
  “Panel”, “Row” or “Tab”. The +/− marker is silent where the label already
  says “Added” or “Removed”.
- **Plain text** (the corpus and `renderReviewText`) renders the word instead of
  the icon, including for the header's own element: `+ Added Row "New row"
  under Tab "Tab 1"`.

### Ordering

Ordering is deterministic: the Dashboard node first; then sections in reading
order of the payload layout, with removed sections at their baseline position;
panels in reading order within their section; categories in the fixed order of
the structure table; and fields within a category in a fixed order per
category.

## Change description algorithm

The algorithm must be deterministic and flexible enough to read as if a person
wrote it. Human-friendliness is the most important property.

1. **Diff:** compute the differences between the baseline and the payload with
   the same `jsonDiff` the Changes tab uses (`getDashboardChanges.ts`).
2. **Classify defaults:** move system-filled defaults to System defaults.
3. **Build the tree:** derive dashboard, section, and panel nodes from both
   layouts, matching identities as described above.
4. **Attribute paths:** map each remaining diff path to a node, a category, and
   a field through an ordered rule table. The first matching rule wins. A path
   that no rule matches goes to an “Other” category on the nearest node, so
   nothing is dropped.
5. **Describe each change** with a formatter chosen by the field's value type:

   | Value type | Wording |
   | --- | --- |
   | Short scalar | “Unit: none → percent” |
   | Boolean | “Transparent background: turned on” |
   | Time range, durations, refresh | Shown as in the UI: “Default time range: Last 6 hours → Last 24 hours” |
   | Named list items (queries by ref ID, transformations, overrides, variables, links) | Item-level added, removed, or changed: “Query B: added”, “Override ‘errors’: changed” |
   | Long or structured value | “changed”, with the before and after values on demand |
   | Set or cleared value | “Description: added” or “Description: removed” |

6. **Label fields:** use a dictionary of human labels for known spec fields. For
   plugin options and field config, use the labels the panel plugin already
   shows in the panel editor, so Review uses the same words users see while
   editing: “Legend › Mode” rather than `legend.displayMode`. Each option's
   label is its category path plus its name:
   - Plugin options come from the plugin's options supplier
     (`PanelPlugin.getPanelOptionsSupplier()`), which builds the items the
     options pane shows.
   - Field config comes from the plugin's `fieldConfigRegistry`, which covers
     both standard options (unit, thresholds, …) and the plugin's custom field
     options. Overrides reuse the same labels for their properties.

   Some suppliers show options conditionally or build them from the panel's
   data; build the labels from the payload's options and fall back where an
   option has no label. When no label is available, or the plugin isn't loaded,
   fall back to a humanized key path (`legend.showLegend` → “Legend › Show
   legend”).

The rule table, the label dictionary, and the formatters are the flexible parts;
everything else is fixed.

### Test-driven development

Develop the algorithm test-first against a corpus of example pairs: a baseline
spec, a payload spec, and the expected Review output written as readable text.
Each example covers one situation (a renamed panel, a query added, a section
removed with its panels, a restructure, an untitled panel, a deeply nested
section, a plugin option change, a default filled in). Grow the corpus whenever a
summary reads badly, and treat the expected text as the human-friendliness
specification.

### Completeness

Every `jsonDiff` path must be claimed by exactly one change in the tree,
Metadata, or System defaults. Add a test that runs this check over the whole
example corpus, so “complete” is testable rather than a promise.

`lifecycle/specDiff.ts` is a useful starting point but doesn't cover everything
on its own. For example, its `variablesOf` reads only top-level variables, so it
misses the variables and annotations that v2 rows and tabs can hold, and its
`SETTINGS_FIELDS` list doesn't include `preload`.

### System defaults

A difference is a system default when the baseline doesn't set a value and the
payload's value is one Grafana fills in automatically, not one the user chose:
plugin versions, panel option and field config defaults added as plugins load,
and schema defaults. Defaults are listed, never hidden, so the overview stays
complete without cluttering the user's own changes.

Approach to evaluate: `lifecycle/pendingChangesHistory.ts` already rebases edits
to keep defaults the scene filled in from counting as edits to untouched panels.
Reuse that logic, or classify a path as a default when it is absent in the
baseline and equal to the schema or plugin default in the payload. When a path
is ambiguous, treat it as a user change, so nothing meaningful is tucked away.

### Translations

All wording goes through the in-house i18n API (`t`, `<Trans />`). Don't build
sentences by joining English fragments: give each category, field label, and
formatter its own key, use the i18n API's plural handling for counts and
ordinals, and format lists with the API's locale-aware list support (or
`Intl.ListFormat` if it has none). Values from the dashboard itself, such as
titles and query text, are shown as is.

The first version is text-only. It does not include layout diagrams, screenshots,
rendered before/after charts, or other visual comparisons.

## Performance

`jsonDiff` is already slow on large dashboards; the Changes tab works around this
by building its diff groups asynchronously. Compute the Review summary only when
the Review tab is open, and do it asynchronously with a loading state, so the
Details tab isn't slowed down. Recompute when save options or the Save As form
values change while Review is open. Plugin option labels may need the panel
plugins loaded; fall back to humanized keys rather than blocking the summary.

The Save As form parks its title and description on the drawer
(`useParkSaveFormDraft`) but not its copy-tags value, so the Review needs that
value exposed as well.

## Failure behavior

If the summary cannot be generated, show the summary failure wording and its
link to Changes. Do not present a failed summary as an empty summary or
“No changes to save”.

Summary failure must not prevent the existing save flow from working. Users can
return to Details and save.

## Phase 1: review experience prototype

Implement the Review tab, comparison semantics, change tree, change description
algorithm, overview, collapsible Metadata and System defaults
sections, navigation, and failure behavior described above, within the scope
above.

Acceptance checks:

- Details remains the default; Review and Changes coexist as separate tabs, and
  Review follows Changes' visibility rule.
- Review appears only for v2 dashboards and the covered save flows.
- Review provides no Save action and offers a return to Details.
- The overview line and change-type counts summarize the whole change before any
  detail.
- Changes are grouped as Dashboard, then sections, then panels, and every node's
  place is clear at any nesting depth (indentation, or `under <path>` where
  sections in between are hidden).
- Every section and panel node is collapsible; collapsed nodes show a one-line
  summary; large edits start with panels collapsed.
- Field changes read “from → to”; long or structured values reveal before and
  after on demand.
- Removed sections list the panels and sections removed with them; moved panels
  say where they came from; layout type changes appear as one entry.
- Human, assistant, and mixed edits produce summaries based on the same final
  state, without requiring author attribution.
- Undone edits do not appear; additions and removals remain visible.
- Changes to the time range, variable values, and refresh save options are
  reflected in the review of the actual save payload.
- Save As copy is described against its source, including title, description,
  and tag changes from the Details form.
- Every `jsonDiff` path is claimed by an entry in the change tree, Metadata, or
  System defaults, verified over the example corpus.
- Untitled and duplicate-titled items are named by position and section title.
- Unfamiliar settings get a humanized label rather than being omitted or
  assigned speculative meaning.
- New dashboards are clearly described as creations with additions.
- Summary failure is explicit and leaves the existing diff and save flow usable.
- Opening the drawer and using Details aren't slowed down by the summary.

Analytics instrumentation is deferred entirely to phase 2.

## Later: filters

Filtering completes the “zoom and filter” step of the mantra. It is left out of
the first version to keep the prototype small, and is planned for after it:

- **Change-type filters:** the overview's change-type counts (added, changed,
  removed, moved) become toggles that narrow the tree to those changes.
- **Name filter:** a text field below the overview narrows the tree to items
  whose name matches. A matching section or panel keeps its ancestors' headers,
  so its path stays visible.
- **Combined filters:** both filters apply together. Metadata and System
  defaults are filtered the same way.
- **No matches:** show “No changes match the current filters” with a
  “Clear filters” action, through the in-house i18n API.
- **Acceptance check:** filters narrow the tree without changing what the
  overview counts, and clearing them restores the full tree.

## Phase 2: discovery and return-usage measurement

Instrument the following funnel:

| Step | Definition |
| --- | --- |
| Opportunity | The save drawer opens with Review available. |
| Discovery | A user deliberately opens Review for the first time. |
| Return usage | A user opens Review in a later eligible editing session. |
| Next action | The user saves, inspects Changes, or returns to editing. |

Deduplicate repeated tab clicks within a session. Measure return usage among
users who discovered Review and subsequently had another eligible opportunity to
save changes. Repeated visits within one save drawer do not count as return usage.

Event properties can describe change categories and counts without collecting
dashboard text or queries. Phase 2 must account for its later tracking start when
interpreting first discovery and return usage; phase 1 does not establish an
instrumented adoption baseline.

## Implementation starting points

Local code exploration identified these relevant files. They are investigation
starting points, not a claim about what is deployed or a prescribed architecture.

- `public/app/features/dashboard-scene/saving/SaveDashboardDrawer.tsx`: existing
  Details and Changes tabs, their visibility rule, and the save drawer structure.
- `public/app/features/dashboard/components/SaveDashboard/SaveDashboardDiff.tsx`:
  existing technical diff, including the folder and predefined variables
  metadata entries.
- `public/app/features/dashboard-scene/saving/getDashboardChanges.ts`: comparison
  of save models, including save-option handling and v2 section variables.
- `public/app/features/dashboard-scene/saving/useDashboardSaveChanges.ts`: keeps
  the comparison current while the drawer is open.
- `public/app/features/dashboard-scene/saving/useSaveDashboard.ts` and
  `SaveDashboardAsForm.tsx`: the Save As payload (`getSaveAsModel`) and its form
  values.
- `public/app/features/dashboard-scene/serialization/DashboardSceneSerializer.ts`:
  stored initial save model and baseline updates after successful saves.
- `public/app/features/dashboard-scene/scene/DashboardScene.tsx`
  (`markPendingChangesRecorded`) and
  `public/app/features/dashboard-scene/lifecycle/pendingChangesHistory.ts`:
  baseline moves for pending changes, and the rebase that filters out
  system-filled defaults.
- `public/app/features/dashboard-scene/lifecycle/specDiff.ts` and
  `public/app/features/dashboard-scene/lifecycle/CompareDrawer.tsx`: existing
  semantic change categories in the separate assistant proposal flow. Evaluate
  reuse, but do not assume these cover every persisted difference.
- `packages/grafana-schema/src/schema/dashboard/v2/types.spec.gen.ts`: the v2
  spec the change tree's categories map to.
- `packages/grafana-data/src/panel/PanelPlugin.ts` (`getPanelOptionsSupplier`,
  `fieldConfigRegistry`) and
  `public/app/features/dashboard/components/PanelEditor/getVisualizationOptions.tsx`:
  how the panel editor builds option names and categories, which Review reuses
  as labels.
- `public/app/features/dashboard-scene/utils/interactions.ts`: relevant
  interaction instrumentation for phase 2.

## Implementation status

As of 2026-11-05, phase 1 is implemented on the branch
`grafakus/human-friendly-diffs`. The first version, the `/simplify` pass and
DESIGN-DIFFING.md are committed and pushed (up to `fd7f217a987`); the
names-with-icons work and feedback rounds 17–27 are uncommitted. Commit only
when the user asks.

- **Feature toggle:** `grafana.humanFriendlyDashDiffs` in
  `pkg/services/featuremgmt/registry.go`, with the generated files. It is on
  locally in the git-ignored `conf/custom.ini`. This backend change must go in
  a separate PR from the frontend code.
- **Code:** `public/app/features/dashboard-scene/saving/review/`
  - `types.ts`: the contract (see below).
  - `summarizeDashboardChanges.ts`: the pure, synchronous entry point.
  - `structure/`: layout walking, identity matching, naming, moves, and the
    claims for every `layout` diff.
  - `describe/`: diffing (`flatDiff`, equivalent to `jsonDiff` without line
    numbers), the attribution rule table, formatters, labels, named lists,
    show/hide rules, system defaults, the overview, and `properties.ts` (what
    an added or removed element is set to).
  - `ui/`: the Review tab, the async `useReviewSummary` hook, and the lazy pane
    behind an error boundary.
  - `richText.ts`: rich text (names with icons) and its i18n helpers.
  - `renderReviewText.ts`: the plain-text rendering the corpus is written in
    (test-only).
  - `__corpus__/`: `WORDING.md`, the builders, the real-plugin harness, and the
    example cases under `cases/`.
  - Tests: `corpus.test.ts`, `completeness.test.ts`, `qa.test.ts` (QA edge
    cases), and unit tests next to each module.
- **Drawer integration:**
  - `saving/SaveDashboardDrawer.tsx` gains a Review tab: Details, Review, Changes.
  - `saving/SaveDashboardAsForm.tsx` and `saving/useParkSaveFormDraft.ts`
    expose Copy tags, and the provisioned form keeps it.
  - Strings are in `public/locales/en-US/grafana.json`; run `make i18n-extract`
    after wording changes.
- **Gate that must stay green:**
  - `pnpm exec jest --no-watch public/app/features/dashboard-scene/saving public/app/features/provisioning/components/Dashboards`
  - `pnpm exec tsc --noEmit -p tsconfig.json`
  - ESLint and Prettier on the changed files
  - the circular-dependency count (the `circular-dependencies-count` skill)
  - the secret check before any commit

### Decisions made during implementation

These refine or override earlier sections of this plan. WORDING.md has the
exact phrasing.

- **Contract:**
  - Every user-facing string in a `ReviewSummary` is translated by the engine;
    the UI only lays it out.
  - Every diff path is claimed exactly once: by a node, a change, or
    `bookkeeping`. Index-shift noise from array inserts and removals is claimed
    by the change that caused it.
  - Bookkeeping: `revision`, and the panel `id` when the element exists on
    both sides.
- **Comparison:**
  - Save As and new dashboards compare the `getSaveAsModel` payload built from
    the form draft (title, description, Copy tags); save options don't apply
    to them.
  - Review is always available for Save As copies and new dashboards, even
    with no edits, because a copy always differs from its source.
  - During a pending-change preview the baseline is the recorded pending
    change, and Review says so.
- **"Not set" values:**
  - `''`, absent, null, `[]` and `{}` all mean "not set"; moving between them
    shows nothing.
  - Some absent values mean on or inherit, not off: `matchRowHeights` (absent
    is on) and an auto grid item's `fitContent` (absent follows the layout).
- **System defaults:**
  - Every plugin version change, whether filled in or bumped.
  - A value added where the baseline had none, when it equals the real plugin,
    field-config or schema default.
  - After a visualization type change, the new plugin's defaults.
  - Ambiguous cases stay user changes.
- **Value wording:**
  - Values use the editor's words when the plugin is loaded: choice labels,
    unit names, color schemes.
  - Common query text keys read "Query text".
  - Sizes read in words ("wider and taller") and threshold details as readable
    steps.
- **Names as rich text** (see [Naming items](#naming-items) for the rules):
  - `types.ts` has `NamedElement` (`kind`: panel, row or tab; `name`: the
    quoted title or `(unnamed)`; `self` for the header's own element) and
    `RichText = Array<string | NamedElement>`. Node labels and status texts,
    `removedContents`, `movedInContents` and System defaults owner labels are
    `RichText`.
  - Each sentence stays one translatable `t()` call with a literal key, so
    `make i18n-extract` finds it. `rich(parts, render)` in `richText.ts` passes
    sentinel placeholders to `t()` and splices the rich parts back in, so
    translators can reorder them. `richToPlain` renders the kind words for
    tests.
  - Structure nodes carry their own `name` and `parentPath`, not a finished
    header. `buildTree` composes the header (“Added”, “Removed”, “under”),
    because only it knows which ancestors the tree shows.
- **Show/hide rules** are described part by part in the editor's words:
  visibility, match rules, and each rule matched by kind and variable name.
- **New dashboards:**
  - Every change counts as added.
  - The overview line drops "Changes to" because the intro already says the
    dashboard is being created.
- **Performance:** about 0.3 s for 1,200 panels.
  - The summary is only computed while Review is open, off the critical path,
    and recomputed on dashboard edits.
  - Structure building grows faster than linearly beyond about 2,000 panels.

### Product owner feedback rounds

1. Granular show/hide rules instead of JSON.
2. Double quotes around names.
3. Element type first (`Row "EU Cluster"`), with content outline icons.
4. +/− markers instead of "added"/"removed".
5. Moves relative to a neighbour.
6. No ordinal suffixes: duplicate names read "at position N".
7. Updated nodes read "was updated (N changes)".
8. An unconfigured panel turned into a visualization reads "Visualization: set
   to Gauge", with the new plugin's defaults under System defaults.
9. Move texts name both sections (`moved from Tab "Tab 2" to Tab "Tab 1",
   after Panel "P2"`).
10. Text values (titles, descriptions, labels, names) are shown in double
    quotes.
11. Panel show/hide rules get their own category, named "Conditional
    rendering" for every node kind. A row's collapse state moves to
    Properties.
12. The visibility line reads `Panel visibility: Show → Hide` with a single
    rule, and `Panel visibility when the rules match: …` with several rules.
13. Updated nodes count changes, not properties: `was updated (2 changes)`.
14. Headers and change lines are aligned in columns: chevron, +/− marker,
    icon, label. The marker column is reserved for a list of siblings when any
    of them is added or removed, and the icon column for change lines when any
    line has an icon. The marker column was replaced in round 18.
15. Variables are named by their type, as the variable editor names it:
    `Query variable "query0"`, `Custom variable "env"`. An added or removed
    variable has a Show toggle revealing its configuration as JSON, without
    `options` (the values it last resolved to). Replaced by round 20.
16. Added or removed ad hoc filters, annotation queries and links (dashboard
    and panel links) get the same Show toggle with their configuration as
    JSON.
17. Names carry icons instead of the words "Panel", "Row" and "Tab", and
    headers say what happened: `Added "New row" under ⧉"Tab 1"`,
    `Removed "Tab 2"`. Panels get the verb too. The rules are in
    [Naming items](#naming-items) and the implementation under
    [Decisions](#decisions-made-during-implementation); PLAN-ICON-NAMES.md was
    the working plan.
18. The +/− marker of an added or removed node is the toggle in place of
    the chevron when the node has content, so markers always share the
    chevron column (this replaced the separate marker column of round 14).
19. A new section that a layout change filled with existing elements (group
    into rows or tabs) says so in its header, `Added "New row" (3 panels
    moved to it)`, and its toggle reveals a flat list of those elements, with
    icons and no toggles of their own. Panels really moved in from a surviving
    section keep their move line. A section with only this list starts
    collapsed.
20. Every added or removed element is reviewable: its +/− toggle reveals what
    it is set to, one property per line. Only what's set is listed (empty
    values, `false` and schema or plugin defaults are left out), in the
    editor's words. Literal values sit inline (`Description: "Cache hits"`,
    `Multi-value: Yes`), a few short names too (`Tags: "prod", "eu"`), and
    lists and objects wait behind Show as JSON (`Queries (1)`). The title is
    the header's name and isn't repeated. This covers panels, rows, tabs,
    variables, annotations, links, queries, transformations and overrides;
    removed elements read from the saved version. Nodes with only this list
    start collapsed.
21. Progressive disclosure: several changed fields of one element read as
    one line naming it, `Query variable "number" (8 changes)`, whose chevron
    reveals the changes worded without the name. A single field change stays
    one line, `Query variable "number" › Query: changed`. The counts count
    each field change.
22. A moved-in element that also changed is listed once: its node takes its
    bullet's place in the "moved to it" list. A new section's layout is
    listed only when it isn't the auto grid every new row or tab starts with.
23. An added section's header counts what it holds: `(3 panels moved to it,
    1 panel added)`, `(1 panel added)`.
24. The overview line names the top-level elements that hold changes, by
    kind: a change inside a tab is a change to the tab (`Changes to 1 tab`,
    `Changes to the dashboard and 2 rows`). A panel moved between sections
    counts for both ends. The change counts below it still count every change.
25. Every added or removed element is reviewable, a switch variable at its
    defaults included (see [Principles](#principles-for-every-decision)).
26. Progressive disclosure for conditional rendering: an added or removed
    rule set is one line with a rule count, its settings behind a chevron. An
    added or removed rule says so, and the category heading recalls the match
    logic, which holds for the whole set: `Conditional rendering (Match all)`
    then `+ Rule added: Time range less than 30 minutes`.
27. The header's “N added” and “N removed” counts carry the same + and −
    markers as the items in the tree.

QA re-verified rounds 3–12 in the app; see [Open items](#open-items).

### Open items

- **Not verified in the app:**
  - the failure state;
  - a folder move;
  - the variables and refresh save options;
  - v1, repository, template and managed dashboards;
  - assistant-made edits.
- **QA's latest app pass** (pending decisions):
  - **Ambiguous neighbours:** a move's neighbour is named without its position,
    so twins are ambiguous.
  - **Long nested moves:** moves between nested sections repeat the whole
    destination path.
  - **Wrapping:** moved-and-updated headers wrap at narrow widths.
- **Not verified in the app:** a move between tabs (drag-and-drop only
  reordered panels within a tab) and changing an existing variable rule.
- **Accepted wording (from QA):**
  - rare duplicate query refIds;
  - a renamed variable reads as a removal plus an addition;
  - the predefined variables label comes from the existing formatter.
- **Later: word what's behind Show.** Queries, plugin options and field config
  of an added element are JSON behind Show. They could be listed one level
  deeper in the editor's words (round 20 stops at the first level). Enum values
  (`Refresh: onDashboardLoad`) are shown as stored.
- **Category names** stay "Plugin options" and "Field config", as in this
  plan, although QA suggested the editor's terms.
- **A drawer test** waits 300 ms of real time.

## Team and working process

The work runs as a small team of subagents coordinated by one orchestrating
session. To resume, an orchestrator reads this plan, `types.ts`, and
`__corpus__/WORDING.md`, then briefs the agents below with only their own part.

### Roles and file ownership

Each agent writes only to its own files and reads anything.

| Role | Owns | Responsibility |
| --- | --- | --- |
| Orchestrator | `review/types.ts`, `review/richText.ts`, `review/renderReviewText.ts`, `conf/`, `public/locales/**`, this plan, git | Turns feedback into decisions and contract changes, briefs and sequences the agents, relays questions, runs `make i18n-extract` and the gate, verifies in the app. Only the orchestrator commits, and only when the user asks. |
| Corpus author | `review/__corpus__/**`, `corpus.test.ts`, `completeness.test.ts` | Writes the expected wording in WORDING.md and as example cases, from the plan and the feedback, never from the implementation. It never writes engine code. |
| Engine A (structure) | `review/structure/**` | Identity, naming, ordering, moves and restructures, and the claims for `layout` diffs. |
| Engine B (describe) | `review/describe/**`, `review/summarizeDashboardChanges.ts` | Attribution, formatters, labels, system defaults, overview, node status text, and the final assembly. |
| UI | `review/ui/**`, the drawer, the Save As form, `useParkSaveFormDraft.ts`, the provisioned form's call site | The Review tab, states, accessibility, icons, markers, the async hook, and the drawer tests. |
| QA | `review/qa.test.ts` | Checks the acceptance list in the app (never saving), writes edge-case tests, and reviews wording. |
| Code reviewer | none | A fresh-eyes review of the whole diff, without the orchestrator's conclusions. |

### How a change flows

1. **Feedback becomes decisions.** The orchestrator turns feedback into concrete
   rules and, when needed, a contract change in `types.ts`, and updates
   `renderReviewText.ts` if the text format changes.
2. **The corpus author goes first.** It updates WORDING.md and the cases, which
   then fail against the engines. The expected text is the specification.
3. **The engines and the UI work in parallel**, each in its own files, until
   the corpus, completeness and unit tests pass. They report contract needs
   instead of editing the contract.
4. **The orchestrator integrates.** It runs i18n extraction and the gate.
5. **QA and review.** QA re-verifies in the app; code review runs after large
   rounds. Findings go back to step 1 as regression cases first.

### Rules for every agent

- Never commit, push, switch branches, run `make i18n-extract`, or edit
  `public/locales/**`.
- Every user-facing string goes through `t()` or `<Trans>` under
  `dashboard-scene.review.*`, with no English fragment concatenation. Use i18n
  plurals and ordinals, and the `{{x, list}}` formatter for lists.
- Run single test files with `pnpm exec jest --no-watch <path>`, never plain
  `pnpm test`.
- In the app, never click Save; discard edits when done.

### Facts the agents rely on

- **`jsonDiff` compares arrays by index.** Inserting or removing an item shifts
  every later index, so items are re-identified semantically: panels by
  element name, queries by refId, variables by name, sections by title then
  position. Paths keep JSON-pointer escapes.
- **The v2 save models** (`changeInfo.initialSaveModel` and `changedSaveModel`)
  are bare specs, sorted and null-free. Save options are applied to the
  payload in place.
- **The Save As payload** is `scene.getSaveAsModel({ isNew, title, description,
  copyTags })`. The form defaults Copy tags to off for copies.
- **Plugins:** labels come from `getPanelOptionsSupplier()` with a
  `PanelOptionsEditorBuilder`, and from `fieldConfigRegistry`. Loaded plugins
  come from `syncGetPanelPlugin`; the hook preloads them with
  `importPanelPlugin`, capped at 1 s.
- **Reading order:** grids by (y, x); auto grids, rows and tabs by array order.

## Outside phase 1

- Classic (v1) dashboards and dashboards migrated from v1 to v2 while editing.
- Save as template, Save template, provisioning repository saves, and managed
  resources that can't be edited.
- Change-type and name filters (see [Later: filters](#later-filters)).
- A discovery indicator such as a “New” badge.
- Comprehension studies with users.
- Visual comparisons, including rendered charts and layout previews.
- Selective acceptance, per-change revert, or editing inside Review.
- Per-change authorship or a chronological activity history.
- LLM-generated explanations and claims about behavioral correctness.
- Replacement of the existing Changes tab.
- New concurrent-edit conflict detection or merging.
- Discovery, return-usage, or funnel analytics instrumentation.
