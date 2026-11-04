import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const noChanges: ReviewCorpusCase = {
  name: 'no changes',
  input: { mode: 'save', baselineKind: 'saved', baseline, payload: edit(baseline, () => {}) },
  expected: text`
No changes to save
`,
};
