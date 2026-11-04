import { edit, panel, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

// Saved before anyone picked a visualization: the placeholder plugin, no version, no options.
const unconfigured = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('New panel', { id: 1, viz: '__unconfigured-panel', vizVersion: '' });
});

// What the gauge plugin and getPanelOptionsWithDefaults fill in once Gauge is picked.
const asGauge = edit(unconfigured, (d) => {
  d.elements['panel-1'] = panel('New panel', {
    id: 1,
    viz: 'gauge',
    options: {
      barShape: 'flat',
      barWidthFactor: 0.5,
      effects: { barGlow: false, centerGlow: false, gradient: true },
      endpointMarker: 'point',
      minVizHeight: 75,
      minVizWidth: 75,
      orientation: 'auto',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      segmentCount: 1,
      segmentSpacing: 0.3,
      shape: 'gauge',
      showThresholdLabels: false,
      showThresholdMarkers: true,
      sizing: 'auto',
      sparkline: true,
      textMode: 'auto',
    },
    fieldConfigDefaults: {
      color: { mode: 'thresholds' },
      thresholds: {
        mode: 'absolute',
        steps: [
          { color: 'green', value: -Infinity },
          { color: 'red', value: 80 },
        ],
      },
    },
  });
});

export const unconfiguredToGauge: ReviewCorpusCase = {
  name: 'unconfigured panel set to Gauge: the plugin defaults are system defaults',
  input: { mode: 'save', baselineKind: 'saved', plugins: ['gauge'], baseline: unconfigured, payload: asGauge },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "New panel" was updated (1 change) · visualization
  [Visualization]
    Visualization: set to Gauge

System defaults (2)
  Panel "New panel"
    Plugin options: set to the Gauge defaults
    Field config: set to the Gauge defaults
`,
};

// Without the plugin nothing proves these are defaults, so they stay in the tree, readable.
export const unconfiguredToGaugeWithoutPlugin: ReviewCorpusCase = {
  name: 'unconfigured panel set to Gauge, plugin not loaded: values stay in the tree',
  input: { mode: 'save', baselineKind: 'saved', baseline: unconfigured, payload: asGauge },
  expected: text`
Changes to 1 panel
Counts: 3 added, 15 changed, 0 removed, 0 moved

Panel "New panel" was updated (18 changes) · visualization, plugin options, field config
  [Visualization]
    Visualization: set to gauge
  [Plugin options]
    Bar shape: set to flat
    Bar width factor: set to 0.5
    Effects: added
      before: (none)
      after: {
          "barGlow": false,
          "centerGlow": false,
          "gradient": true
        }
    Endpoint marker: set to point
    Min viz height: set to 75
    Min viz width: set to 75
    Orientation: set to auto
    Reduce options: added
      before: (none)
      after: {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        }
    Segment count: set to 1
    Segment spacing: set to 0.3
    Shape: set to gauge
    Show threshold markers: turned on
    Sizing: set to auto
    Sparkline: turned on
    Text mode: set to auto
  [Field config]
    Color: set to From thresholds
    Thresholds: added
      before: (none)
      after: Base: green
        80: red

System defaults (1)
  Panel "New panel"
    Show threshold labels: turned off
`,
};
