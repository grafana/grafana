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
