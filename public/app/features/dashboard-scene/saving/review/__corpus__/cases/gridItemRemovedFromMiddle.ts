import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

// 'Latency' keeps its place on the grid but moves from index 2 to index 1 of the items array.
export const gridItemRemovedFromMiddle: ReviewCorpusCase = {
  name: 'grid item removed from the middle (index shift is not a change to other panels)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      delete d.elements['panel-2'];
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.splice(1, 1);
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Panel "Errors"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};
