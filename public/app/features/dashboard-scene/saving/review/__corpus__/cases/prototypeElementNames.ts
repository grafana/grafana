import { edit, gridItem, panel, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

// Element names are user data; names that are also Object.prototype members must not be looked up there.
export const prototypeElementNames: ReviewCorpusCase = {
  name: "panels added under element names 'constructor' and 'toString'",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['constructor'] = panel('Builds', { id: 4 });
      d.elements['toString'] = panel('Deploys', { id: 5 });
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.push(gridItem('constructor', { x: 0, y: 16, w: 12, h: 8 }));
        d.layout.spec.items.push(gridItem('toString', { x: 12, y: 16, w: 12, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 2 panels
Counts: 2 added, 0 changed, 0 removed, 0 moved

+ Added Panel "Builds"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]

+ Added Panel "Deploys"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};
