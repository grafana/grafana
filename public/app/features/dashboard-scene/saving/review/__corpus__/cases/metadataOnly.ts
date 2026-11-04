import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const folderMoved: ReviewCorpusCase = {
  name: 'metadata only: folder moved',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, () => {}),
    metadata: { folder: { before: 'General', after: 'Ops' } },
  },
  expected: text`
Counts: 0 added, 1 changed, 0 removed, 0 moved

Metadata (1)
  Folder: General → Ops
`,
};

export const predefinedVariablesChanged: ReviewCorpusCase = {
  name: 'metadata only: predefined variables changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, () => {}),
    metadata: { predefinedVariables: { before: 'None', after: 'All / All' } },
  },
  expected: text`
Counts: 0 added, 1 changed, 0 removed, 0 moved

Metadata (1)
  Predefined variables: None → All / All
`,
};
