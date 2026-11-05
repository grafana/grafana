import { edit, gridItem, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

export const panelMovedBetweenRows: ReviewCorpusCase = {
  name: 'panel moved between rows',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind !== 'RowsLayout') {
        return;
      }
      const [api, db] = d.layout.spec.rows;
      if (api.spec.layout.kind === 'GridLayout' && db.spec.layout.kind === 'GridLayout') {
        api.spec.layout.spec.items.splice(1, 1);
        db.spec.layout.spec.items.push(gridItem('panel-2', { x: 0, y: 8, w: 12, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 2 rows
Counts: 0 added, 0 changed, 0 removed, 1 moved

Row "DB"
  Panel "Errors" moved from Row "API" to Row "DB", after Panel "Connections"
`,
};
