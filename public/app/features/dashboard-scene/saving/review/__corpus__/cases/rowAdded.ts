import { edit, gridOf, panel, row, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

export const rowAdded: ReviewCorpusCase = {
  name: 'row added with a new panel',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-5'] = panel('Hit rate', { id: 5 });
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows.push(row('Cache', gridOf('panel-5')));
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 2 added, 0 changed, 0 removed, 0 moved

+ Added Row "Cache" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`,
};
