import { edit, panel, panelSpecOf, text, timeseriesFieldConfigDefaults } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = edit(gridDashboard(), (d) => {
  d.elements['panel-2'] = panel('Errors', {
    id: 2,
    fieldConfigDefaults: { ...timeseriesFieldConfigDefaults(), unit: 'none' },
  });
});

export const fieldConfigUnit: ReviewCorpusCase = {
  name: 'field config unit changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-2').vizConfig.spec.fieldConfig.defaults.unit = 'percent';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · field config
  [Field config]
    Standard options › Unit: Number → Percent (0-100)
`,
};
