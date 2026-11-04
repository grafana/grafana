import { edit, panelSpecOf, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();
const payload = edit(baseline, (d) => {
  panelSpecOf(d, 'panel-1').vizConfig.spec.options.legend.displayMode = 'table';
});

export const pluginOptionChanged: ReviewCorpusCase = {
  name: 'plugin option changed, labelled by the time series plugin',
  input: { mode: 'save', baselineKind: 'saved', plugins: ['timeseries'], baseline, payload },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · plugin options
  [Plugin options]
    Legend › Mode: List → Table
`,
};

export const pluginOptionChangedWithoutPlugin: ReviewCorpusCase = {
  name: 'plugin option changed, plugin not loaded (humanized label)',
  input: { mode: 'save', baselineKind: 'saved', baseline, payload },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · plugin options
  [Plugin options]
    Legend › Display mode: list → table
`,
};
