# Tier 2 timeline prototype - NOTES

THROWAWAY. Delete once the design decision is folded into the real components.

## Question

Tier 2 of span-pruning Trace View work (grafana/grafana-adaptivetraces-app#1018):
a summary span's waterfall bar represents a **wall-clock time window** (earliest
start to latest end of N aggregated spans), not a single operation's duration. The
default solid bar is misleading - it looks like one long op when it is really N ops.

How should a user **read and interact with** a summary span in the waterfall so the
window-vs-operation distinction is obvious, and the aggregate stats (count, min /
median / max) are legible inline?

This is one design variant (not a multi-variant look-comparison). The point is the
interaction model, not picking between three visuals.

## Run

No build step. Either:

```bash
open public/app/features/explore/TraceView/components/TraceTimelineViewer/__prototype__/tier2-timeline.prototype.html
```

or serve the repo root and browse to the file:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/public/app/features/explore/TraceView/components/TraceTimelineViewer/__prototype__/tier2-timeline.prototype.html
```

React + Babel load from unpkg CDN, so the browser needs network access (the sandbox
does not gate the browser). Data is hardcoded from `../model/pruned-spans.fixture.ts`.

## The design under test

- **Summary bar** = dashed window container spanning earliest-start to latest-end,
  with left-anchored **nested min / median / max range bands** drawn to the same
  timeline scale. You can see at a glance that the longest single op is shorter than
  the window. A count chip (`x5`) sits at the bar start; `min | median | max` prints
  as the inline label.
- **Status-quo toggle** flips back to the misleading solid bar so the problem the
  design solves is visible side by side.
- **Zoom-to-span** (crosshair on the row) reframes the timeline to the span window,
  making the band detail legible without leaving the waterfall.
- **Hover tooltip** gives the full stat table plus a plain-language "this is a window
  of N ops" explanation.
- **Summary <-> preserved-outlier linking**: selecting a summary highlights its
  preserved-outlier sibling rows (red rail); selecting an outlier links back via
  `aggregation.summary_span_id`.
- **Expanded detail** shows an aggregate stat grid + outlier list instead of raw
  `aggregation.*` tag rows (with a toggle to reveal the raw tags = status quo).

## Where this maps in real code (when folding in)

- `TraceTimelineViewer/SpanBar.tsx` - the bar rendering (window container + bands + chip).
- `TraceTimelineViewer/SpanBarRow.tsx` - name-column badges, label, row linking state.
- `TraceTimelineViewer/SpanDetail/` - aggregate stat grid + outlier list.
- Zoom already exists via the SpanGraph minimap; reuse rather than reinvent.

## Verdict

TODO (fill in after playing with it): which interactions are keepers, which to drop,
what is missing. Candidate open questions:
- Are the nested bands legible at real (un-zoomed) bar widths, or is the count chip +
  tooltip the only thing that survives at small sizes?
- Should min/median/max bands be left-anchored (distribution feel) or positioned in
  real time? Left-anchored is a magnitude view, not a time view - is that confusing
  next to a time-axis waterfall?
- Is zoom-to-span discoverable enough, or does the summary need an always-on affordance?
