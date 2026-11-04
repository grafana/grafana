import { edit, panelSpecOf, query, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

export const overviewMixed: ReviewCorpusCase = {
  name: 'changes across the dashboard, two rows and four panels (overview and ordering)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.title = 'Service overview (v2)';
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.hideHeader = true;
        d.layout.spec.rows[1].spec.collapse = true;
      }
      d.elements['panel-1'].spec.title = 'Request rate';
      panelSpecOf(d, 'panel-2').transparent = true;
      panelSpecOf(d, 'panel-3').data.spec.queries.push(query('B', 'pg_stat_activity_count'));
      panelSpecOf(d, 'panel-4').data.spec.queryOptions.maxDataPoints = 500;
    }),
  },
  expected: text`
Changes to the dashboard, 2 sections, and 4 panels
Counts: 1 added, 6 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Title: "Service overview" → "Service overview (v2)"

Row "API" was updated (1 change) · properties
  [Properties]
    Hide row header: turned on
  Panel "Request rate" was updated (1 change) · properties
    [Properties]
      Title: "Requests" → "Request rate"
  Panel "Errors" was updated (1 change) · properties
    [Properties]
      Transparent background: turned on

Row "DB" was updated (1 change) · properties
  [Properties]
    Row: collapsed
  Panel "Queries" was updated (1 change) · data
    [Data]
      + Query "B"
  Panel "Connections" was updated (1 change) · data
    [Data]
      Max data points: set to 500
`,
};
