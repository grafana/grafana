import { edit, grid, gridItem, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

// The grid keeps its items sorted by position, so moving 'Errors' below 'Latency' also reorders the array.
// Its reading order changed, so it reads as a move next to its new neighbour rather than as a position.
export const panelPositionAndSize: ReviewCorpusCase = {
  name: 'panel moved below another panel and resized within a grid',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.layout = grid([
        gridItem('panel-1', { x: 0, y: 0, w: 12, h: 8 }),
        gridItem('panel-3', { x: 0, y: 8, w: 12, h: 8 }),
        gridItem('panel-2', { x: 0, y: 16, w: 24, h: 8 }),
      ]);
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 1 moved

Panel "Errors" moved after Panel "Latency" and was updated (1 change) · layout
  [Layout]
    Size: wider
      before: 12 × 8
      after: 24 × 8
`,
};
