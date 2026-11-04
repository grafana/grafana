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
