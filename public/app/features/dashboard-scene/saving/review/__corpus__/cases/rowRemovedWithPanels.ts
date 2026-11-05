import { edit, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

export const rowRemovedWithPanels: ReviewCorpusCase = {
  name: 'row removed with its panels',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      delete d.elements['panel-3'];
      delete d.elements['panel-4'];
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows.pop();
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Row "DB"
  · Layout: custom grid
  removed with it: Panel "Queries"
  removed with it: Panel "Connections"
`,
};
