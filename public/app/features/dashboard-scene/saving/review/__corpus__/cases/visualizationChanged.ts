import { edit, panel, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const fieldConfigDefaults = {
  color: { mode: 'thresholds' },
  mappings: [],
  thresholds: {
    mode: 'absolute',
    steps: [
      { color: 'green', value: -Infinity },
      { color: 'red', value: 80 },
    ],
  },
};

const baseline = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', { id: 1, fieldConfigDefaults });
});

// Switching the visualization: the old plugin's options go with the Visualization line, the new plugin's
// defaults go to System defaults, and only the value the user picked (Color mode) is listed in the tree.
export const visualizationChanged: ReviewCorpusCase = {
  name: 'visualization type changed (time series to stat)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries', 'stat'],
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-1'] = panel('Requests', {
        id: 1,
        viz: 'stat',
        vizVersion: '11.1.0',
        fieldConfigDefaults,
        options: {
          colorMode: 'background',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'auto',
          reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
          textMode: 'auto',
        },
      });
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 2 changed, 0 removed, 0 moved

Panel "Requests" was updated (2 changes) · visualization, plugin options
  [Visualization]
    Visualization: Time series → Stat
  [Plugin options]
    Stat styles › Color mode: set to Background Gradient

System defaults (1)
  Panel "Requests"
    Plugin options: set to the Stat defaults
`,
};
