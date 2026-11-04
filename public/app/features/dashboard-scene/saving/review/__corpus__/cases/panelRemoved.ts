import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const panelRemoved: ReviewCorpusCase = {
  name: 'panel removed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      delete d.elements['panel-3'];
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.pop();
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Panel "Latency"
`,
};
