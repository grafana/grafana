import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

// Older saves stored `description: ''`; the serializer now writes `description || undefined`.
const emptyDescription = gridDashboard({ description: '' });

export const emptyDescriptionDropped: ReviewCorpusCase = {
  name: "description '' → absent is no change (both mean not set)",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: emptyDescription,
    payload: edit(emptyDescription, (d) => {
      delete d.description;
    }),
  },
  expected: text`
No changes to save
`,
};

export const emptyDescriptionDroppedInCopy: ReviewCorpusCase = {
  name: "Save As copy: description '' → absent is no change",
  input: {
    mode: 'saveAsCopy',
    baselineKind: 'saved',
    sourceTitle: 'Service overview',
    baseline: emptyDescription,
    payload: edit(emptyDescription, (d) => {
      d.title = 'Service overview Copy';
      delete d.description;
    }),
  },
  expected: text`
Copy of "Service overview"
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Title: "Service overview" → "Service overview Copy"
`,
};

const described = gridDashboard({ description: 'Golden signals for the public API' });

export const descriptionCleared: ReviewCorpusCase = {
  name: 'short description cleared',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: described,
    payload: edit(described, (d) => {
      delete d.description;
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Description: cleared (was "Golden signals for the public API")
`,
};

const longDescription = gridDashboard({
  description: 'Golden signals for the public API.\nOwned by the checkout team; page #checkout-oncall.',
});

export const longDescriptionRemoved: ReviewCorpusCase = {
  name: 'multi-line description removed (details, no "undefined")',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: longDescription,
    payload: edit(longDescription, (d) => {
      delete d.description;
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 0 changed, 1 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Description: removed
      before: Golden signals for the public API.
        Owned by the checkout team; page #checkout-oncall.
      after: (none)
`,
};
