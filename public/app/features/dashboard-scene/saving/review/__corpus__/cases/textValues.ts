import { edit, panelSpecOf, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();
const payload = edit(baseline, (d) => {
  panelSpecOf(d, 'panel-2').vizConfig.spec.fieldConfig.defaults.displayName = 'Errors';
});

// Display name is typed into a text box, so its value is quoted like a title.
export const fieldConfigTextValue: ReviewCorpusCase = {
  name: 'field config text value (display name) is quoted',
  input: { mode: 'save', baselineKind: 'saved', plugins: ['timeseries'], baseline, payload },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · field config
  [Field config]
    Standard options › Display name: set to "Errors"
`,
};

// A standard field config option is known without the plugin, so it is still read as text.
export const fieldConfigTextValueWithoutPlugin: ReviewCorpusCase = {
  name: 'field config text value (display name) is quoted without the plugin',
  input: { mode: 'save', baselineKind: 'saved', baseline, payload },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · field config
  [Field config]
    Display name: set to "Errors"
`,
};
