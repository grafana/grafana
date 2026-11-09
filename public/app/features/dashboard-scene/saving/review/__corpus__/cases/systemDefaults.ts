import { edit, panel, panelSpecOf, text, timeseriesOptions } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

// The panel plugin was loaded for the first time since the last save and stamped its version.
const unversioned = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', { id: 1, vizVersion: '' });
});

export const pluginVersionFilledIn: ReviewCorpusCase = {
  name: 'system default: plugin version filled in',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: unversioned,
    payload: edit(unversioned, (d) => {
      panelSpecOf(d, 'panel-1').vizConfig.version = '11.0.0';
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (1)
  Panel "Requests"
    Plugin version: set to 11.0.0
`,
};

// Saved before the time series plugin had a `tooltip.sort` option; loading the panel fills in its default.
const withoutSort = edit(gridDashboard(), (d) => {
  const options = timeseriesOptions();
  options.tooltip = { hideZeros: false, mode: 'single' };
  d.elements['panel-1'] = panel('Requests', { id: 1, options });
});

export const pluginOptionDefaultFilledIn: ReviewCorpusCase = {
  name: 'system default: plugin option default filled in (plugin loaded)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: withoutSort,
    payload: edit(withoutSort, (d) => {
      panelSpecOf(d, 'panel-1').vizConfig.spec.options.tooltip.sort = 'none';
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (1)
  Panel "Requests"
    Tooltip › Values sort order: set to None
`,
};

// Without the plugin, nothing proves 'none' is a default: when in doubt it is the user's change.
export const optionAddedWithoutPlugin: ReviewCorpusCase = {
  name: 'ambiguous: option added while the plugin is not loaded stays a user change',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: withoutSort,
    payload: edit(withoutSort, (d) => {
      panelSpecOf(d, 'panel-1').vizConfig.spec.options.tooltip.sort = 'none';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · plugin options
  [Plugin options]
    Tooltip › Sort: set to none
`,
};

const tableLegend = edit(gridDashboard(), (d) => {
  panelSpecOf(d, 'panel-1').vizConfig.spec.options.legend.displayMode = 'table';
});

// The baseline set a value, so going back to the default is something the user did.
export const optionChangedToDefault: ReviewCorpusCase = {
  name: 'ambiguous: option changed to its default value stays a user change',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: tableLegend,
    payload: edit(tableLegend, (d) => {
      panelSpecOf(d, 'panel-1').vizConfig.spec.options.legend.displayMode = 'list';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · plugin options
  [Plugin options]
    Legend › Mode: Table → List
`,
};

const withoutPlacement = edit(gridDashboard(), (d) => {
  delete panelSpecOf(d, 'panel-1').vizConfig.spec.options.legend.placement;
});

// Absent in the baseline but not the plugin's default ('bottom'): the user chose it.
export const optionAddedWithNonDefaultValue: ReviewCorpusCase = {
  name: 'ambiguous: option added with a value other than the default stays a user change',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries'],
    baseline: withoutPlacement,
    payload: edit(withoutPlacement, (d) => {
      panelSpecOf(d, 'panel-1').vizConfig.spec.options.legend.placement = 'right';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · plugin options
  [Plugin options]
    Legend › Placement: set to Right
`,
};

// Saved by an older Grafana that left out empty fields; the current serializer always writes them.
// An empty description is the same as none, so only the filled-in `hidden: false` is listed.
const olderSave = edit(gridDashboard(), (d) => {
  const spec: Partial<ReturnType<typeof panelSpecOf>> = panelSpecOf(d, 'panel-1');
  delete spec.description;
  const querySpec: { hidden?: boolean } = panelSpecOf(d, 'panel-1').data.spec.queries[0].spec;
  delete querySpec.hidden;
});

export const systemDefaultsEmptyValues: ReviewCorpusCase = {
  name: 'system defaults: empty values written on an unedited save',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: olderSave,
    payload: edit(olderSave, (d) => {
      const spec = panelSpecOf(d, 'panel-1');
      spec.description = '';
      spec.data.spec.queries[0].spec.hidden = false;
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (1)
  Panel "Requests"
    Query "A" › Hide response: turned off
`,
};

// Older saves stored `description: ''`; the serializer now writes `description || undefined`.
const emptyDescription = gridDashboard({ description: '' });

export const emptyDescriptionDropped: ReviewCorpusCase = {
  name: "description '' → absent is no change (both mean not set)",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: emptyDescription,
    payload: edit(emptyDescription, (d) => {
      delete d.description;
    }),
  },
  expected: text`
No changes to save
`,
};

export const emptyDescriptionDroppedInCopy: ReviewCorpusCase = {
  name: "Save As copy: description '' → absent is no change",
  input: {
    mode: 'saveAsCopy',
    baselineKind: 'saved',
    sourceTitle: 'Service overview',
    baseline: emptyDescription,
    payload: edit(emptyDescription, (d) => {
      d.title = 'Service overview Copy';
      delete d.description;
    }),
  },
  expected: text`
Copy of "Service overview"
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Title: "Service overview" → "Service overview Copy"
`,
};

const described = gridDashboard({ description: 'Golden signals for the public API' });

export const descriptionCleared: ReviewCorpusCase = {
  name: 'short description cleared',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: described,
    payload: edit(described, (d) => {
      delete d.description;
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Description: cleared (was "Golden signals for the public API")
`,
};

const longDescription = gridDashboard({
  description: 'Golden signals for the public API.\nOwned by the checkout team; page #checkout-oncall.',
});

export const longDescriptionRemoved: ReviewCorpusCase = {
  name: 'multi-line description removed (details, no "undefined")',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: longDescription,
    payload: edit(longDescription, (d) => {
      delete d.description;
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 0 changed, 1 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Description: removed
      before: Golden signals for the public API.
        Owned by the checkout team; page #checkout-oncall.
      after: (none)
`,
};

// Grafana's own plugin-change path (VizPanel.changePluginType → getPanelOptionsWithDefaults) wrote these payloads.
const unconfiguredPanel = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('New panel', { id: 1, viz: '__unconfigured-panel', vizVersion: '' });
});

// Pie chart's default color seeds a fixed color, which Grafana keeps alongside the classic palette.
export const unconfiguredToPieChart: ReviewCorpusCase = {
  name: 'system default: unconfigured panel set to Pie chart keeps its seeded fixed color',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['piechart'],
    baseline: unconfiguredPanel,
    payload: edit(unconfiguredPanel, (d) => {
      d.elements['panel-1'] = panel('New panel', {
        id: 1,
        viz: 'piechart',
        options: {
          legend: { displayMode: 'list', placement: 'bottom', showLegend: true },
          pieType: 'pie',
          reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
          sort: 'desc',
          tooltip: { hideZeros: false, mode: 'single', sort: 'none' },
        },
        fieldConfigDefaults: {
          color: { fixedColor: '#73BF69', mode: 'palette-classic' },
          custom: { hideFrom: { legend: false, tooltip: false, viz: false } },
        },
      });
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "New panel" was updated (1 change) · visualization
  [Visualization]
    Visualization: set to Pie chart

System defaults (2)
  Panel "New panel"
    Plugin options: set to the Pie chart defaults
    Field config: set to the Pie chart defaults
`,
};

// Saved without a thresholds mode or base value, as older or provisioned dashboards can be.
const timeseriesWithBareThresholds = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', {
    id: 1,
    fieldConfigDefaults: { thresholds: { steps: [{ color: 'green' }, { color: 'red', value: 90 }] } },
  });
});

// Grafana fills in the thresholds mode and the base step (−∞, saved as 0): neither is the user's edit.
export const timeseriesToGaugeFixesThresholds: ReviewCorpusCase = {
  name: 'system default: time series set to Gauge fills in the thresholds mode and base step',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    plugins: ['timeseries', 'gauge'],
    baseline: timeseriesWithBareThresholds,
    payload: edit(timeseriesWithBareThresholds, (d) => {
      d.elements['panel-1'] = panel('Requests', {
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
              { color: 'green', value: 0 },
              { color: 'red', value: 90 },
            ],
          },
        },
      });
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · visualization
  [Visualization]
    Visualization: Time series → Gauge

System defaults (2)
  Panel "Requests"
    Plugin options: set to the Gauge defaults
    Field config: set to the Gauge defaults
`,
};
