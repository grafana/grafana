import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const timeRangeAndRefresh: ReviewCorpusCase = {
  name: 'default time range and auto refresh changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.timeSettings.from = 'now-24h';
      d.timeSettings.autoRefresh = '1m';
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 2 changed, 0 removed, 0 moved

Dashboard was updated (2 changes) · controls
  [Controls]
    Default time range: Last 6 hours → Last 24 hours
    Auto refresh: Off → 1m
`,
};
