import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const panelRenamed: ReviewCorpusCase = {
  name: 'panel renamed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-2'].spec.title = 'Error rate';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Error rate" was updated (1 change) · properties
  [Properties]
    Title: "Errors" → "Error rate"
`,
};
