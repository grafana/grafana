import { edit, gridItem, panel, text, timeseriesFieldConfigDefaults } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

/*
 * An added element lists what it is set to, behind its + toggle: literal values inline, lists and objects behind
 * Show. What Grafana filled in (plugin defaults, empty values, `false`) is left out.
 */

const baseline = gridDashboard();

export const addedPanelProperties: ReviewCorpusCase = {
  name: 'added panel lists what it is set to, without plugin defaults',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-4'] = panel('Cache hits', {
        id: 4,
        // Test data a person typed into the panel editor, not UI text
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        description: 'Cache hits during last week',
        subtitle: 'Per minute',
        transparent: true,
        fieldConfigDefaults: { ...timeseriesFieldConfigDefaults(), unit: 'percent' },
      });
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.push(gridItem('panel-4', { x: 12, y: 8, w: 12, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

+ Added Panel "Cache hits"
  · Description: "Cache hits during last week"
  · Subtitle: "Per minute"
  · Visualization: Time series
  · Queries (1) [Show]
  · Transparent background: Yes
  · Field config [Show]
`,
};
