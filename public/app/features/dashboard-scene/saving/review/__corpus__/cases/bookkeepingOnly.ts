import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard({ revision: 3 });

// Panel ids and the plugin revision stamp are internal: they are claimed as bookkeeping and never shown.
export const bookkeepingOnly: ReviewCorpusCase = {
  name: 'bookkeeping only: panel id renumbered, revision bumped',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.revision = 4;
      d.elements['panel-3'].spec.id = 7;
    }),
  },
  expected: text`
No changes to save
`,
};
