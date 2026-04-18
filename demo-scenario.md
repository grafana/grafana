# Demo: "Black Friday war room" -- recording script

Total time: ~5 minutes. Rules are pre-provisioned via `setup-demo.sh --rules`.

---

## Setup (before recording)

```bash
./setup-demo.sh --rules
```

This creates 3 users, 3 teams, the dashboard in a folder, and applies 11 rules.

Prepare 4 browser tabs/profiles, each logged in as a different user:

1. `admin` (password: `admin`) -- member of all 3 teams
2. `sre-user` (password: `password`) -- member of `platform-sre`
3. `product-user` (password: `password`) -- member of `product-eng`
4. `business-user` (password: `password`) -- member of `business`

All 4 tabs open: `http://localhost:3000/d/war-room-black-friday`

Set time range to **Last 6 hours** on all tabs to start.

---

## Act 1 -- The problem (30s)

> Show the `admin` tab. Click through all 4 tabs.

"This is our Black Friday war room dashboard. Everyone shares the same URL.
Right now I'm logged in as admin -- I see everything: four tabs, eight rows,
two dozen panels. The SRE team doesn't care about revenue. Business doesn't
want to see pod counts. Product is scrolling past infrastructure rows to find
their checkout funnel. We've been asked to make three separate dashboards.
Instead, we configured rules that make one dashboard adapt to whoever is
looking at it."

---

## Act 2 -- Persona-based visibility (1m 30s)

### SRE view

> Switch to the `sre-user` browser tab.

"Here's the same dashboard, same URL, but I'm logged in as an SRE.
The War room tab shows the golden signals row -- shared by everyone --
plus the SRE overview row. The Checkout and Business rows are gone.
I have the Infrastructure tab, but Checkout & payments is hidden."

> Click through the visible tabs to show them.

### Product view

> Switch to the `product-user` browser tab.

"Product engineer. Same URL again. The War room tab now shows golden signals
plus the Checkout health row. The SRE and Business rows are gone.
The Checkout & payments tab is here, but Infrastructure is hidden."

### Business view

> Switch to the `business-user` browser tab.

"Business analyst. Golden signals plus Business KPIs. Revenue per minute,
active users, average order value. No infrastructure, no checkout internals.
This is the view the VP wanted all along -- four numbers answering
'are we fine?' plus their own KPIs."

---

## Act 3 -- Time range driven behaviors (1m 30s)

> Switch back to the `sre-user` tab.

### Deep dive tab

> Point out there are only 3 visible tabs (Deep dive is hidden).

"The Deep dive tab with investigation tables is currently hidden because
our time range is 6 hours. Watch what happens when I zoom in."

> Change time range to **Last 30 minutes**.

"The Deep dive tab appeared. It only shows when the time range is under
1 hour -- designed for active incident investigation."

### Collapse row

> Go to the **Infrastructure** tab. Note the "Compute & network" row is visible.

> Change time range to **Last 15 minutes**.

"The Compute & network row just collapsed automatically. When zoomed into a
short window during an incident, the heavy infrastructure panels collapse
so the SRE can focus on traffic. They can still expand it manually."

> Click the row header to expand it, showing it's still accessible.

### Fast refresh

> Change time range to **Last 5 minutes**. Point at the refresh picker.

"Notice the refresh picker jumped to 5 seconds. A rule detects when the
time range drops below 5 minutes and speeds up the auto-refresh -- incident
mode. When I zoom back out..."

> Change time range to **Last 2 hours**.

"...the refresh interval reverts. The Compute row expands. The Deep dive
tab disappears. All automatic, all reversible."

---

## Act 4 -- Query override (45s)

> Set time range to **Last 5 minutes** on the `sre-user` tab.

> Go to the **Infrastructure** tab. Point at the **Request rate by service** panel.

"Two more rules kick in at the 5-minute threshold. The Request rate panel
switched from static test data to a live streaming simulation -- you can see
the data points arriving in real time."

> Go to the **War room** tab. Point at the **P99 latency** stat in the golden signals row.

"The P99 latency stat did the same -- its query was swapped for a streaming
sine wave. In production this would be a high-resolution streaming query
for real-time incident triage."

> Change time range to **Last 1 hour** to show revert.

"Back to 1 hour. Streaming stopped, original queries restored. The panel
doesn't know anything changed -- the rules handled it."

---

## Act 5 -- How it works (45s)

> Switch to `admin`. Enter **Edit mode**. Open **Dashboard settings > Rules**.

"All 11 rules are visible in this flow editor. Each node shows the rule name
and whether it's currently active -- green means active, red means inactive."

> Hover over a target node (e.g., the Infrastructure tab node).

"Hovering a target highlights the element on the dashboard canvas."

> Double-click a rule node to open the editor.

"Double-clicking opens the rule editor. Conditions and outcomes are
registry-based -- new types can be added without changing any existing code."

> Close the editor. Open the **Rules** sidebar pane in view mode.

"The rules sidebar is also available in view mode, giving viewers a read-only
overview of what rules are shaping their dashboard."

---

## Close (15s)

"One dashboard. Four audiences. Eleven rules. Zero copies to maintain.
Rules target tabs, rows, and individual panels with four different outcomes:
visibility, row collapse, refresh interval, and query override.
Everything is declarative, visual, and extensible.
This is what truly dynamic dashboards look like."

---

## Appendix: what this looks like without rules

Without dashboard rules the same experience requires multiple dashboards
and manual workarounds. This section is useful as a talking point when
stakeholders ask "why not just copy the dashboard?"

### Persona-based visibility requires separate dashboards

There is no way to conditionally show or hide content based on who is
viewing without rules. The only option is one dashboard per persona:

| Dashboard              | Content                                                            | Panels |
| ---------------------- | ------------------------------------------------------------------ | ------ |
| War room -- SRE        | Golden signals + SRE overview + Infrastructure + Deep dive         | ~16    |
| War room -- Product    | Golden signals + Checkout health + Checkout & payments + Deep dive | ~13    |
| War room -- Business   | Golden signals + Business KPIs + Deep dive                         | ~10    |
| War room -- Leadership | Golden signals + Deep dive                                         | ~7     |

That is 4 dashboards with ~46 panels total vs 1 dashboard with ~24 panels.
Every change to a shared row (golden signals, deep dive) must be repeated
in all 4 dashboards. Drift is inevitable.

### Time-range behaviors have no equivalent

These rules react to the viewer's current time range selection.
Separate dashboards cannot replicate them at all:

| Rule                                        | Without rules                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep dive tab (show when < 1h)              | Always visible or missing entirely.                                                                                                                         |
| Fast refresh (5s when < 5m)                 | User must manually change the refresh picker during an incident.                                                                                            |
| Collapse row (Compute & network when < 30m) | User must manually collapse/expand.                                                                                                                         |
| Override query (streaming when < 5m)        | Requires duplicate panels: one static, one streaming. Element-level conditional rendering can swap them, but panel count doubles for each overridden panel. |

### Side-by-side comparison

|                      | With rules            | Without rules                               |
| -------------------- | --------------------- | ------------------------------------------- |
| Dashboards           | 1                     | 4                                           |
| Total panels         | 24                    | ~50+                                        |
| URLs to share        | 1                     | 4 (each team needs the right one)           |
| Refresh behavior     | Automatic             | Manual                                      |
| Row collapse         | Automatic             | Manual                                      |
| Query switching      | Automatic, reversible | Duplicate panels + element-level conditions |
| Maintenance cost     | Change once           | Repeat in 4 places                          |
| Deep dive visibility | Time-range driven     | Always visible or absent                    |
