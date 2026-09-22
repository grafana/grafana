# TableNG ad-hoc filtering experiment

Enable `table.refresh` and `table.refreshNewFeatures` to use transformation-backed
filtering. Applied state consists only of serializable `filterByValue` configs, one
per field and frame/parent scope. Controls select and update individual predicates;
there is no intermediate `FilterType` model or whole-stage encode/decode step.

The table keeps one ordered view list under the Scenes runtime owner
`grafana:table-view`. `set(owner, configs)` replaces that owner's list; individual
controls preserve other configs when editing their own transforms. `PanelContext`
exposes the Scenes controller and its type directly. Other runtime owners retain
independent transformations and subscriptions.

## Temporary Scenes dependency patch

Scenes and scenes-react use the stable `8.18.0` packages. The checked-in Yarn
patch for Scenes replaces its distribution with the tested build from Scenes
PR #1651 at `9edc66c9`, retention-aware field cleanup at `fb45d856`, and upstream
undo/redo support (#1645), cherry-picked as `d7592f92`. The current build at
`47d138bf` also includes test teardown cleanup and the missing-data tracking fix
from `e845c9cc`: temporary missing data preserves cleanup candidates, while
explicitly disabling cleanup releases tracking. No canary publication or
local `file:` dependency is required. The patch includes CJS, ESM, declarations,
and source maps; the previous ownerless-controller patch is removed.

Cleanup remains enabled: arrays retained by upstream sources or runtime stages
survive hiding/filtering, and obsolete rendered arrays are cleared after those
references disappear. This does not establish global ownership across consumers.

To regenerate, build `packages/scenes` at the above revision with Rollup, run
`yarn patch @grafana/scenes@npm:8.18.0`, replace the extracted `dist` with that build,
and run `yarn patch-commit -s <extracted-directory>`. Keep the root resolution
pointing at the generated patch, keep direct versions at `8.18.0`, and preserve
CloudWatch's separate `8.18.2` dependency (patch-commit may rewrite all consumers).
Run `yarn install` and verify `yarn install --immutable` before committing.

Verification: the patched distribution matches the local build byte-for-byte;
99 Grafana tests across six table/context suites, `tsc --noEmit`, changed-file
ESLint/formatting, and an immutable Yarn install passed with stable dependencies.
The browser rerun passed 12 Playwright checks. Earlier local-build verification
passed 233 Scenes tests (46 snapshots, one existing skip). Two stale browser
assertions were excluded: the override picker accessible-name expectation and
the expectation that pinning is unavailable. No heap benchmark was performed.

Dashboard tables use that Scenes-owned list. Standalone Explore, Inspect, and
Flamegraph tables keep the same config array locally and operate only
on their supplied data. Sharing that array can restore applied filtering without
supplemental table state; URL persistence itself is not implemented here.

Checkbox filters use formatted `inSet` membership, retaining display configuration
and timezone. Raw field names and labels identify fields independently of display
names. Frame identity includes schema and occurrence; nested filters also guard
against parent identity changes. Child predicates precede parent filters, and
filters precede column organization.

Popup selections and input text are unsubmitted drafts. Apply updates only the
edited config using the current stage. Cancel discards the draft. External changes
to that predicate reload an open editor; unrelated stage changes preserve its
draft. Compound or unsupported predicates remain intact and display an explanation
with an explicit Clear action. Clearing such a filter removes the entire config,
including any other fields in its compound predicate. Disabled configs remain intact.

The flag-off adapter retains legacy filtering. Source-index projection and
cross-filter distributions execute the reusable filtering implementation; they
remain necessary for table callbacks and option lists. Carrying provenance from
the host stage could eliminate the additional projection pass in a later change.

## Numeric and date ranges

`numericRange` supports inclusive optional bounds and explicit missing/non-finite
handling. Numeric filters provide a histogram, slider, raw bounds, and a match
preview. Date filters use the shared dashboard time-range inputs and adjacent
calendar, interpreted in the host timezone with millisecond precision. Both use
Apply/Cancel and store only their applied predicate in the transform.

The development dashboard **Panel Tests - Table - Ad-hoc filters and sorting**
(`table-adhoc-filter-sort`) exercises these controls. Duration bounds 50–200 match
60 of 126 rows. Observed-at bounds `2026-09-17 12:00`–`2026-09-17 12:30` in
America/New_York match 31 rows. Development servers remain stopped.

Relative dates, nonlinear histogram bins, and URL persistence remain future work.

## Column pinning

Pinning writes column order to the ad-hoc organize transformation. Frozen column
count is derived separately from viewer-local pinned identities, seeded by the
configured panel option. Hiding a pinned column does not freeze its replacement;
unpinning retains the organized order behind any remaining pinned columns.

Restoring serialized organize configs restores column order without pin state.
Ephemeral frozen-column options and URL persistence remain separate work.
Standalone tables retain their existing local column-order handling.

## Resize observer follow-up

Repeated browser resizing exposed ResizeObserver delivery loops involving both the
grid dimension callback and Floating UI's floating-element callback. Deferring only
one callback did not eliminate the reproduced warning. The branch patches both
dependencies to coalesce resize work into the next animation frame, cancelling
pending callbacks during cleanup. The Floating UI patch includes its ESM and CommonJS
entry points and preserves immediate initial positioning and existing scroll handling.
No global observer replacement or error-overlay suppression is used.

Regression tests exercise real dependency callbacks: grid virtualization updates
only after the scheduled frame, repeated measurements use the latest size, floating
updates coalesce, and unmount/cleanup cancels queued work. Browser width/height sweeps
with tooltips and a pinned column no longer show the overlay; the pinned column
retains its organized position and frozen state. These patches should move upstream
into the corresponding packages before a production rollout.

## Sorting

Viewer sorting uses a separate `sortBy` config in the same stage, after filters
and before organization. Saved initial sorting seeds the stage when a filter is
first applied. Table-specific comparisons and multi-key sorting live in the shared
transformer; standalone tables use the same logic. Sorting remains the final commit
in this experimental stack.
