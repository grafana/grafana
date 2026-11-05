import { edit, panel, panelSpecOf, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', {
    id: 1,
    overrides: [
      {
        matcher: { id: 'byName', options: 'errors' },
        properties: [{ id: 'color', value: { fixedColor: 'red', mode: 'fixed' } }],
      },
    ],
  });
});

export const overridesAddedAndChanged: ReviewCorpusCase = {
  name: 'override changed (property added) and override added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline,
    payload: edit(baseline, (d) => {
      const overrides = panelSpecOf(d, 'panel-1').vizConfig.spec.fieldConfig.overrides;
      overrides[0].properties.push({ id: 'unit', value: 'percent' });
      overrides.push({ matcher: { id: 'byName', options: 'latency' }, properties: [{ id: 'unit', value: 'ms' }] });
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (2 changes) · field config
  [Field config]
    Override "errors" › Standard options › Unit: set to Percent (0-100)
    + Override "latency"
      · Standard options › Unit: ms
`,
};
