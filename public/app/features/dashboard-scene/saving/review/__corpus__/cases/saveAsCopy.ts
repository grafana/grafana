import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard({ description: 'Golden signals for the public API', tags: ['prod', 'api'] });

// The Save As form gives the copy a new title and description and doesn't copy tags by default.
export const saveAsCopy: ReviewCorpusCase = {
  name: 'Save As copy: new title and description, tags dropped',
  input: {
    mode: 'saveAsCopy',
    baselineKind: 'saved',
    sourceTitle: 'Service overview',
    baseline,
    payload: edit(baseline, (d) => {
      d.title = 'Service overview Copy';
      d.description = 'Copy for the checkout team';
      d.tags = [];
    }),
  },
  expected: text`
Copy of "Service overview"
Changes to the dashboard
Counts: 0 added, 2 changed, 2 removed, 0 moved

Dashboard was updated (4 changes) · properties
  [Properties]
    Title: "Service overview" → "Service overview Copy"
    Description: "Golden signals for the public API" → "Copy for the checkout team"
    - Tag "prod"
    - Tag "api"
`,
};
