# TableNG ad-hoc filtering experiment

Enable `table.refresh` and `table.refreshNewFeatures` to use transformation-backed
filtering. Applied state consists only of serializable `filterByValue` configs, one
per field and frame/parent scope. Controls select and update individual predicates;
there is no intermediate `FilterType` model or whole-stage encode/decode step.

Runtime/ad-hoc transformations are one ordered view list per panel, with no tags
or owner groups. `set(configs)` replaces the whole list; individual controls preserve
other configs when editing their own transforms. The Scenes canary is patched to
use this same contract internally, pending an upstream release.

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
