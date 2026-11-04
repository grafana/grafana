import { edit, panelSpecOf, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const thresholdsChanged: ReviewCorpusCase = {
  name: 'thresholds changed (structured value, with details)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-2').vizConfig.spec.fieldConfig.defaults.thresholds = {
        mode: 'absolute',
        steps: [
          { color: 'green', value: 0 },
          { color: 'orange', value: 70 },
          { color: 'red', value: 90 },
        ],
      };
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · field config
  [Field config]
    Thresholds: changed
      before: Base: green
        80: red
      after: Base: green
        70: orange
        90: red
`,
};

export const thresholdsModeChanged: ReviewCorpusCase = {
  name: 'thresholds mode changed to percentage',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline,
    payload: edit(baseline, (d) => {
      const { thresholds } = panelSpecOf(d, 'panel-2').vizConfig.spec.fieldConfig.defaults;
      if (thresholds) {
        thresholds.mode = 'percentage';
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · field config
  [Field config]
    Thresholds: changed
      before: Mode: Absolute
        Base: green
        80: red
      after: Mode: Percentage
        Base: green
        80: red
`,
};
