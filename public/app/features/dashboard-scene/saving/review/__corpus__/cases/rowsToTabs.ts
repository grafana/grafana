import { edit, tab, tabs, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

// Every panel ends up under a new kind of section, but nothing moved: one layout entry, no per-panel moves.
export const rowsToTabs: ReviewCorpusCase = {
  name: 'rows converted to tabs (one layout entry)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout = tabs(d.layout.spec.rows.map((r) => tab(r.spec.title, r.spec.layout)));
      }
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Layout: changed from rows to tabs
`,
};
