import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const pendingChangesBaseline: ReviewCorpusCase = {
  name: 'baseline is a recorded pending change',
  input: {
    mode: 'save',
    baselineKind: 'pendingChanges',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-3'].spec.title = 'p95 latency';
    }),
  },
  expected: text`
Baseline: pending changes
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "p95 latency" was updated (1 change) · properties
  [Properties]
    Title: "Latency" → "p95 latency"
`,
};
