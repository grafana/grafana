import { edit, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

// Rows have no ID: same position and the same panels make it the same row with a new title.
export const rowRenamed: ReviewCorpusCase = {
  name: 'row renamed (matched by position and panels)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.title = 'API v2';
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 1 changed, 0 removed, 0 moved

Row "API v2" was updated (1 change) · properties
  [Properties]
    Title: "API" → "API v2"
`,
};
