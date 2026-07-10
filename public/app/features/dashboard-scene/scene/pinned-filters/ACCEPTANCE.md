# Pinned filters — user stories & acceptance checklist

Feature toggle: `dashboardPinnedFilters` (experimental, default off).

Pinned filters promote selected ad hoc filter fields to always-visible, variable-picker-like
controls at the top of the dashboard. They remain ad hoc filters under the hood: injected into
every panel query automatically, cascading against all other filters on the same data source,
and populated by panel-to-panel filtering.

Personas:

- **Author** — edits the dashboard and configures the filter variable.
- **Viewer** — consumes the dashboard; may only pick filter values.

## US1 — Author pins fields without default values

**As an** author, **I want** to pin a subset of filterable fields **so that** viewers can see at
a glance which filters are available without searching through all fields.

- [ ] Given a dashboard with an ad hoc filter variable, when the author opens the variable
      settings with the toggle enabled, then a "Pinned filters" editor is shown (replacing the
      "Default filters" editor).
- [ ] Given the pinned filters editor, when the author adds a pinned filter and picks a field
      from the key dropdown, then the field list matches the data source's filterable keys.
- [ ] Given a pinned field with no default values, when the dashboard is viewed, then the pinned
      control is visible at the top of the dashboard showing the "All" (no restriction) state.
- [ ] Given two pinned fields out of N filterable fields, when the dashboard is viewed, then
      exactly those two pinned controls are visible, plus the regular bulk filter input.

## US2 — Author pins a field with default values

**As an** author, **I want** to pin a field with pre-selected default values **so that** the
dashboard opens pre-filtered.

- [ ] Given a pinned field with default values, when the dashboard loads, then the pinned control
      shows those values and panels are filtered by them.
- [ ] Given a viewer changed a pinned control away from its defaults, when they use the restore
      affordance, then the author's default values are reinstated.

## US3 — Viewer filters all panels from a pinned control

**As a** viewer, **I want** to pick one or more values in a pinned control **so that** every
panel on the dashboard is filtered, without panel queries referencing the filter explicitly.

- [ ] Given a pinned control, when the viewer opens it, then value options are loaded from the
      data source for that field.
- [ ] Given a pinned control with multi-select (v1 default), when the viewer selects two values,
      then all panels using that data source re-query with the filter applied (`=|` OR semantics).
- [ ] Given a pinned selection, when the viewer clears all values from the control, then the
      filter returns to the "All" state and panels show unfiltered data.

## US4 — Cascading between filters

**As a** viewer, **I want** value suggestions to respect my other selections **so that** I am
only offered values that exist in the currently filtered data.

- [ ] Given a selection in pinned control A, when the viewer opens pinned control B, then B's
      value options are constrained by A's selection.
- [ ] Given a selection in pinned control A, when the viewer opens the value dropdown of a bulk
      filter, then options are constrained by A's selection.
- [ ] Given a bulk filter selection, when the viewer opens a pinned control, then its options are
      constrained by the bulk filter.

## US5 — Pinned keys are not offered in the bulk filter

**As a** viewer, **I want** pinned fields to live only in their pinned controls **so that** the
same field is not managed in two places.

- [ ] Given pinned fields, when the viewer opens the bulk filter key dropdown, then pinned keys
      are not suggested.

## US6 — Pinned filters cannot be removed by viewers

**As an** author, **I want** pinned filters to be permanent fixtures **so that** viewers always
see them.

- [ ] Given a pinned control, then the viewer has no way to remove the control itself (only to
      clear its values, returning it to "All").
- [ ] Given viewer changes to pinned and bulk filters, when the viewer uses "Clear filters",
      then bulk filters are removed and pinned filters are restored to the author's defaults
      (or "All" when no defaults).

## US7 — Panel-to-panel filtering populates pinned controls

**As a** viewer, **I want** clicking values in panels to drive the pinned controls **so that**
exploratory filtering scales to any field present in panel data.

- [ ] Given a table panel cell on a pinned field, when the viewer clicks "Filter for value",
      then the pinned control's selection is replaced with the clicked value (no duplicate bulk
      filter is created).
- [ ] Given a bar chart bar on a pinned field, when the viewer uses filter-for from the tooltip,
      then the pinned control's selection is replaced with the clicked value.
- [ ] Given "Filter out value" on any field (pinned or not), then v1 behavior is unchanged from
      today: a regular `!=` filter is appended to the bulk filters. (Known v1 limitation for
      pinned keys; pinned-aware filter-out is deferred.)

## US8 — Non-pinned fields keep today's behavior

**As a** viewer, **I want** panel-to-panel filtering on non-pinned fields to behave exactly as
before **so that** the feature is purely additive.

- [ ] Given a table cell on a non-pinned field, when the viewer clicks "Filter for value", then a
      regular filter pill is added to the bulk filter input.

## US9 — Sharing via URL

**As a** viewer, **I want** my filter state in the URL **so that** I can share filtered views.

- [ ] Given pinned selections and bulk filters, when the URL is copied and reopened, then both
      pinned selections and bulk filters are restored.

## US10 — Persistence round-trip

**As an** author, **I want** pinned configuration saved with the dashboard **so that** it
survives reloads and re-edits.

- [ ] Given pinned fields with custom labels and defaults, when the dashboard is saved and
      reloaded, then pinned config (fields, labels, defaults, operator) round-trips intact.
- [ ] Viewer-picked values are NOT persisted on save; only author-configured defaults are
      (viewer state is URL-only).

## US11 — Custom labels

**As an** author, **I want** to give pinned fields human-readable labels **so that** viewers see
"Loc L1" instead of "territory_location_l1".

- [ ] Given a custom label on a pinned field, when the dashboard is viewed, then the control
      shows the custom label.
- [ ] Given no custom label, then the control shows the raw field name.

## US12 — Feature toggle off

**As an** operator, **I want** the toggle to fully gate the feature **so that** existing
behavior is untouched until we opt in.

- [ ] Given the toggle disabled, then the ad hoc filter UI (including the existing "Default
      filters" editor and origin-filter pills) behaves exactly as before this change.

## Out of scope (v1) — deferred to follow-ups

- Pinned-aware "Filter out value" (deselect from pinned control when value is selected).
- Per-field operator choice (single vs multi); v1 is always multi (`=|`) when the data source
  supports multi-value operators, else `=`.
- Per-field "allow custom values" control (v1 inherits the variable-level setting).
- Drag-and-drop ordering of pinned controls (v1 uses editor list order).
- General P2P add/remove interaction polish in the bulk filter.
