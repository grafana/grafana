import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard({ tags: ['prod', 'staging'] });

export const dashboardProperties: ReviewCorpusCase = {
  name: 'dashboard properties: title, description added, tags, editable, preload, live now, graph tooltip',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.title = 'API service overview';
      d.description = 'Golden signals for the public API';
      d.tags = ['prod', 'slo'];
      d.editable = false;
      d.preload = true;
      d.liveNow = true;
      d.cursorSync = 'Crosshair';
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 1 added, 6 changed, 1 removed, 0 moved

Dashboard was updated (8 changes) · properties
  [Properties]
    Title: "Service overview" → "API service overview"
    Description: set to "Golden signals for the public API"
    - Tag "staging"
    + Tag "slo"
    Editable: turned off
    Preload panels: turned on
    Refresh live dashboards: turned on
    Graph tooltip: Default → Shared crosshair
`,
};
