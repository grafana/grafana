import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  gridOf,
  panel,
  panelSpecOf,
  query,
  text,
  timeseriesFieldConfigDefaults,
  transformation,
} from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const queryAppended: ReviewCorpusCase = {
  name: 'query appended',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries.push(query('B', 'rate(http_requests_total{status=~"5.."}[5m])'));
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    + Query "B"
      · Data source: prometheus-main
      · Editor mode: code
      · Query text: rate(http_requests_total{status=~"5.."}[5m])
      · Legend format: "__auto"
      · Range: Yes
`,
};

const queryInsertedBeforeABaseline = gridDashboard();

// Inserting at index 0 makes the raw diff replace every field of index 0 and add index 1;
// queries are identified by ref ID, so only B is new.
export const queryInsertedBeforeA: ReviewCorpusCase = {
  name: 'query inserted before A, matched by ref ID',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: queryInsertedBeforeABaseline,
    payload: edit(queryInsertedBeforeABaseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries.unshift(query('B', 'rate(http_requests_total{status=~"5.."}[5m])'));
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    + Query "B"
      · Data source: prometheus-main
      · Editor mode: code
      · Query text: rate(http_requests_total{status=~"5.."}[5m])
      · Legend format: "__auto"
      · Range: Yes
`,
};

const queryExpressionChangedBaseline = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', {
    id: 1,
    queries: [query('A', 'sum(rate(http_requests_total{job="api"}[5m]))')],
  });
});

export const queryExpressionChanged: ReviewCorpusCase = {
  name: 'query expression changed (long value, with details)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: queryExpressionChangedBaseline,
    payload: edit(queryExpressionChangedBaseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries[0].spec.query.spec.expr =
        'sum by (status) (rate(http_requests_total{job="api"}[5m]))';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    Query "A" › Query text: changed
      before: sum(rate(http_requests_total{job="api"}[5m]))
      after: sum by (status) (rate(http_requests_total{job="api"}[5m]))
`,
};

const duplicateRefIds = edit(gridDashboard(), (d) => {
  panelSpecOf(d, 'panel-1').data.spec.queries = [query('A', 'up'), query('A', 'down')];
});

export const duplicateRefIdChanged: ReviewCorpusCase = {
  name: 'keeps duplicate query ref IDs complete when the second one changes',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: duplicateRefIds,
    payload: edit(duplicateRefIds, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries = [query('A', 'up'), query('A', 'sideways')];
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    Query "A" › Query text: down → sideways
`,
};

const transformationAddedBaseline = gridDashboard();

export const transformationAdded: ReviewCorpusCase = {
  name: 'transformation added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: transformationAddedBaseline,
    payload: edit(transformationAddedBaseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.transformations.push(
        transformation('organize', { excludeByName: {}, indexByName: {}, renameByName: { Value: 'Requests/s' } })
      );
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    + Transformation "Organize fields by name"
      · Options [Show]
`,
};

const queryOptionsChangedBaseline = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', { id: 1, queryOptions: { interval: '1m' } });
});

export const queryOptionsChanged: ReviewCorpusCase = {
  name: 'query options: max data points set, min interval changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: queryOptionsChangedBaseline,
    payload: edit(queryOptionsChangedBaseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queryOptions = { interval: '30s', maxDataPoints: 500 };
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 2 changed, 0 removed, 0 moved

Panel "Requests" was updated (2 changes) · data
  [Data]
    Max data points: set to 500
    Min interval: 1m → 30s
`,
};

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

const visualizationChangedBaseline = edit(gridDashboard(), (d) => {
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
    baseline: visualizationChangedBaseline,
    payload: edit(visualizationChangedBaseline, (d) => {
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

const unconfiguredAutoGrid = dashboard({
  elements: elements([
    'panel-1',
    panel('New panel', { id: 1, viz: '__unconfigured-panel', options: {}, fieldConfigDefaults: {} }),
  ]),
  layout: autoGrid([autoGridItem('panel-1')]),
});

export const unconfiguredToStat: ReviewCorpusCase = {
  name: 'describes an unconfigured panel switched to a visualization',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: unconfiguredAutoGrid,
    payload: edit(unconfiguredAutoGrid, (d) => {
      const viz = panelSpecOf(d, 'panel-1').vizConfig;
      viz.group = 'stat';
      viz.spec.options = { colorMode: 'value', graphMode: 'area', justifyMode: 'auto', textMode: 'auto' };
    }),
    plugins: ['stat'],
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "New panel" was updated (1 change) · visualization
  [Visualization]
    Visualization: set to Stat

System defaults (1)
  Panel "New panel"
    Plugin options: set to the Stat defaults
`,
};

const pluginOptionChangedBaseline = gridDashboard();
const payload = edit(pluginOptionChangedBaseline, (d) => {
  panelSpecOf(d, 'panel-1').vizConfig.spec.options.legend.displayMode = 'table';
});

export const pluginOptionChanged: ReviewCorpusCase = {
  name: 'plugin option changed, labelled by the time series plugin',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: pluginOptionChangedBaseline,
    payload,
  },
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
  input: { mode: 'save', baselineKind: 'saved', baseline: pluginOptionChangedBaseline, payload },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · plugin options
  [Plugin options]
    Legend › Display mode: list → table
`,
};

const fieldConfigUnitBaseline = edit(gridDashboard(), (d) => {
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
    baseline: fieldConfigUnitBaseline,
    payload: edit(fieldConfigUnitBaseline, (d) => {
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

const thresholdsChangedBaseline = gridDashboard();

export const thresholdsChanged: ReviewCorpusCase = {
  name: 'thresholds changed (structured value, with details)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: thresholdsChangedBaseline,
    payload: edit(thresholdsChangedBaseline, (d) => {
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
    baseline: thresholdsChangedBaseline,
    payload: edit(thresholdsChangedBaseline, (d) => {
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

const overridesAddedAndChangedBaseline = edit(gridDashboard(), (d) => {
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
    baseline: overridesAddedAndChangedBaseline,
    payload: edit(overridesAddedAndChangedBaseline, (d) => {
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

const names = ['panel-1', 'panel-2', 'panel-3', 'panel-4'];

const pluginVersionsBumpedBaseline = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1, vizVersion: '13.3.0' })],
    ['panel-2', panel('Errors', { id: 2, vizVersion: '13.3.0' })],
    ['panel-3', panel('Latency', { id: 3, vizVersion: '13.3.0' })],
    ['panel-4', panel('Saturation', { id: 4, vizVersion: '13.3.0' })]
  ),
  layout: gridOf(...names),
});

// Opened and saved, unedited, after a Grafana upgrade: every loaded panel stamps the new plugin version.
export const pluginVersionsBumped: ReviewCorpusCase = {
  name: 'system defaults: plugin versions bumped by an upgrade, nothing else edited',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: pluginVersionsBumpedBaseline,
    payload: edit(pluginVersionsBumpedBaseline, (d) => {
      names.forEach((name) => {
        panelSpecOf(d, name).vizConfig.version = '13.4.0';
      });
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (4)
  Panel "Requests"
    Plugin version: 13.3.0 → 13.4.0
  Panel "Errors"
    Plugin version: 13.3.0 → 13.4.0
  Panel "Latency"
    Plugin version: 13.3.0 → 13.4.0
  Panel "Saturation"
    Plugin version: 13.3.0 → 13.4.0
`,
};
