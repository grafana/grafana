import { edit, gridItem, panel, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const panelAdded: ReviewCorpusCase = {
  name: 'panel added (header only)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-4'] = panel('Saturation', { id: 4 });
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.push(gridItem('panel-4', { x: 0, y: 16, w: 24, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

+ Added Panel "Saturation"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};
