import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  gridItem,
  gridOf,
  libraryPanel,
  panel,
  panelSpecOf,
  row,
  rows,
  tab,
  tabs,
  text,
  timeseriesFieldConfigDefaults,
} from '../builders';
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

const panelRenamedBaseline = gridDashboard();

export const panelRenamed: ReviewCorpusCase = {
  name: 'panel renamed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: panelRenamedBaseline,
    payload: edit(panelRenamedBaseline, (d) => {
      d.elements['panel-2'].spec.title = 'Error rate';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Error rate" was updated (1 change) · properties
  [Properties]
    Title: "Errors" → "Error rate"
`,
};

const textValuesBaseline = gridDashboard();
const payload = edit(textValuesBaseline, (d) => {
  panelSpecOf(d, 'panel-2').vizConfig.spec.fieldConfig.defaults.displayName = 'Errors';
});

// Display name is typed into a text box, so its value is quoted like a title.
export const fieldConfigTextValue: ReviewCorpusCase = {
  name: 'field config text value (display name) is quoted',
  input: { mode: 'save', baselineKind: 'saved', plugins: ['timeseries'], baseline: textValuesBaseline, payload },
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
  input: { mode: 'save', baselineKind: 'saved', baseline: textValuesBaseline, payload },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · field config
  [Field config]
    Display name: set to "Errors"
`,
};

const transparentTurnedOnBaseline = gridDashboard();

export const transparentTurnedOn: ReviewCorpusCase = {
  name: 'transparent background turned on',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: transparentTurnedOnBaseline,
    payload: edit(transparentTurnedOnBaseline, (d) => {
      panelSpecOf(d, 'panel-2').transparent = true;
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on
`,
};

const libraryPanelBaseline = gridDashboard();

// Turning a panel into a library panel replaces its whole element: its queries and visualization now live
// in the library panel, so they are part of that one change rather than a list of removals.
export const libraryPanelCreated: ReviewCorpusCase = {
  name: 'panel converted to a library panel',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: libraryPanelBaseline,
    payload: edit(libraryPanelBaseline, (d) => {
      d.elements['panel-2'] = libraryPanel('Errors', 'Shared errors', 'lib-errors', 2);
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · properties
  [Properties]
    Converted to library panel "Shared errors"
`,
};

const withLibraryPanel = edit(gridDashboard(), (d) => {
  d.elements['panel-4'] = libraryPanel('Shared', 'Shared lib', 'lib-1', 4);
  if (d.layout.kind === 'GridLayout') {
    d.layout.spec.items.push(gridItem('panel-4', { x: 12, y: 8, w: 12, h: 8 }));
  }
});

export const libraryPanelRemoved: ReviewCorpusCase = {
  name: 'describes a removed library panel by its title',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: withLibraryPanel,
    payload: edit(withLibraryPanel, (d) => {
      delete d.elements['panel-4'];
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.pop();
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Panel "Shared"
  · Library panel: "Shared lib"
`,
};

export const libraryPanelUnlinked: ReviewCorpusCase = {
  name: 'describes a library panel unlinked into a regular panel as one change',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: withLibraryPanel,
    payload: edit(withLibraryPanel, (d) => {
      d.elements['panel-4'] = panel('Shared', { id: 4 });
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Shared" was updated (1 change) · properties
  [Properties]
    Unlinked from library panel "Shared lib"
`,
};

const panelAddedBaseline = gridDashboard();

export const panelAdded: ReviewCorpusCase = {
  name: 'panel added (header only)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: panelAddedBaseline,
    payload: edit(panelAddedBaseline, (d) => {
      d.elements['panel-4'] = panel('Saturation', { id: 4 });
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.push(gridItem('panel-4', { x: 0, y: 16, w: 24, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

+ Added Panel "Saturation"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};

const panelRemovedBaseline = gridDashboard();

export const panelRemoved: ReviewCorpusCase = {
  name: 'panel removed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: panelRemovedBaseline,
    payload: edit(panelRemovedBaseline, (d) => {
      delete d.elements['panel-3'];
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.pop();
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Panel "Latency"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};

const untitledAndDuplicatePanelsBaseline = dashboard({
  elements: elements(
    ['panel-1', panel('Errors', { id: 1 })],
    ['panel-2', panel('Latency', { id: 2 })],
    ['panel-3', panel('Errors', { id: 3 })],
    ['panel-4', panel('', { id: 4 })],
    ['panel-5', panel('', { id: 5 })]
  ),
  layout: tabs([tab('API', gridOf('panel-1', 'panel-2')), tab('DB', gridOf('panel-3', 'panel-4', 'panel-5'))]),
});

export const untitledAndDuplicatePanels: ReviewCorpusCase = {
  name: 'untitled and duplicate-titled panels: the tree gives the section, position only when ambiguous in it',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: untitledAndDuplicatePanelsBaseline,
    payload: edit(untitledAndDuplicatePanelsBaseline, (d) => {
      panelSpecOf(d, 'panel-3').transparent = true;
      panelSpecOf(d, 'panel-5').transparent = true;
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 0 added, 2 changed, 0 removed, 0 moved

Tab "DB"
  Panel "Errors" was updated (1 change) · properties
    [Properties]
      Transparent background: turned on
  Panel (unnamed) at position 3 was updated (1 change) · properties
    [Properties]
      Transparent background: turned on
`,
};

const requests = gridDashboard();

export const panelTitleEmptied: ReviewCorpusCase = {
  name: 'names a panel whose title was emptied by position',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: requests,
    payload: edit(requests, (d) => {
      panelSpecOf(d, 'panel-1').title = '';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel (unnamed) was updated (1 change) · properties
  [Properties]
    Title: cleared (was "Requests")
`,
};

// Two panels share the default title: they are told apart by position, never by an ordinal suffix.
const twoNewPanels = dashboard({
  elements: elements(
    ['panel-1', panel('New panel', { id: 1 })],
    ['panel-2', panel('New panel', { id: 2 })],
    ['panel-3', panel('Latency', { id: 3 })]
  ),
  layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2'), autoGridItem('panel-3')]),
});

// The neighbour needs no position (it is the one next to it); the moved panel's new position ends the text.
export const duplicateMovedFirst: ReviewCorpusCase = {
  name: 'duplicate-titled panel moved to the first place: its new position, no ordinal',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoNewPanels,
    payload: edit(twoNewPanels, (d) => {
      d.layout = autoGrid([autoGridItem('panel-2'), autoGridItem('panel-1'), autoGridItem('panel-3')]);
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 0 removed, 1 moved

Panel "New panel" moved before Panel "New panel", at position 1
`,
};

export const duplicateUpdated: ReviewCorpusCase = {
  name: 'duplicate-titled panel updated: named by its position',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoNewPanels,
    payload: edit(twoNewPanels, (d) => {
      panelSpecOf(d, 'panel-2').transparent = true;
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "New panel" at position 2 was updated (1 change) · properties
  [Properties]
    Transparent background: turned on
`,
};

const tabbed = dashboard({
  elements: elements(
    ['panel-1', panel('Errors', { id: 1 })],
    ['panel-2', panel('Errors', { id: 2 })],
    ['panel-3', panel('Errors', { id: 3, vizVersion: '' })]
  ),
  layout: tabs([tab('API', gridOf('panel-1')), tab('DB', gridOf('panel-2', 'panel-3'))]),
});

// System defaults have no tree around them, so the owner carries its section too.
export const duplicateSystemDefaultOwner: ReviewCorpusCase = {
  name: 'System defaults owner of a duplicate-titled panel names its position and section',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabbed,
    payload: edit(tabbed, (d) => {
      panelSpecOf(d, 'panel-3').vizConfig.version = '11.0.0';
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (1)
  Panel "Errors" at position 2 in Tab "DB"
    Plugin version: set to 11.0.0
`,
};

const rowWithDuplicates = dashboard({
  elements: elements(
    ['panel-1', panel('New panel', { id: 1 })],
    ['panel-2', panel('New panel', { id: 2 })],
    ['panel-3', panel('Queries', { id: 3 })]
  ),
  layout: rows([row('API', gridOf('panel-1', 'panel-2')), row('DB', gridOf('panel-3'))]),
});

export const duplicatesRemovedWithRow: ReviewCorpusCase = {
  name: 'removed with a row: duplicate-titled panels named by their position',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: rowWithDuplicates,
    payload: edit(rowWithDuplicates, (d) => {
      delete d.elements['panel-1'];
      delete d.elements['panel-2'];
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows.shift();
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Row "API"
  · Layout: custom grid
  removed with it: Panel "New panel" at position 1
  removed with it: Panel "New panel" at position 2
`,
};

// Ties in the order diff keep the baseline-first panel in place, so "Latency" is the one that moved.
// The neighbour is named without a position (§3), which is ambiguous here: both twins read "New panel".
export const duplicateMovedAndUpdated: ReviewCorpusCase = {
  name: 'names a moved and updated duplicate-titled panel by its new position',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoNewPanels,
    payload: edit(twoNewPanels, (d) => {
      panelSpecOf(d, 'panel-2').transparent = true;
      if (d.layout.kind === 'AutoGridLayout') {
        const [a, b, c] = d.layout.spec.items;
        d.layout.spec.items = [a, c, b];
      }
    }),
  },
  expected: text`
Changes to 2 panels
Counts: 0 added, 1 changed, 0 removed, 1 moved

Panel "Latency" moved after Panel "New panel"

Panel "New panel" at position 3 was updated (1 change) · properties
  [Properties]
    Transparent background: turned on
`,
};

const names = Array.from({ length: 11 }, (_, i) => `panel-${i + 1}`);

const manyPanelsBaseline = dashboard({
  elements: elements(
    ...names.map((name, i): [string, ReturnType<typeof panel>] => [name, panel(`Node ${i + 1}`, { id: i + 1 })])
  ),
  layout: gridOf(...names),
});

export const manyPanels: ReviewCorpusCase = {
  name: 'more than 10 changed panels start collapsed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: manyPanelsBaseline,
    payload: edit(manyPanelsBaseline, (d) => {
      names.forEach((name) => {
        panelSpecOf(d, name).transparent = true;
      });
    }),
  },
  expected: text`
Changes to 11 panels
Counts: 0 added, 11 changed, 0 removed, 0 moved
Panels start collapsed

Panel "Node 1" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 2" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 3" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 4" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 5" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 6" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 7" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 8" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 9" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 10" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 11" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on
`,
};

// jsonDiff escapes the '/' in the key as '~1'; claims must use the escaped form to match.
const elementKeyWithSlashBaseline = dashboard({
  elements: elements(['api/errors', panel('Errors', { id: 1 })], ['api/latency', panel('Latency', { id: 2 })]),
  layout: gridOf('api/errors', 'api/latency'),
});

export const elementKeyWithSlash: ReviewCorpusCase = {
  name: "element key containing '/'",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: elementKeyWithSlashBaseline,
    payload: edit(elementKeyWithSlashBaseline, (d) => {
      d.elements['api/errors'].spec.title = 'Error rate';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Error rate" was updated (1 change) · properties
  [Properties]
    Title: "Errors" → "Error rate"
`,
};

const prototypeElementNamesBaseline = gridDashboard();

// Element names are user data; names that are also Object.prototype members must not be looked up there.
export const prototypeElementNames: ReviewCorpusCase = {
  name: "panels added under element names 'constructor' and 'toString'",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: prototypeElementNamesBaseline,
    payload: edit(prototypeElementNamesBaseline, (d) => {
      d.elements['constructor'] = panel('Builds', { id: 4 });
      d.elements['toString'] = panel('Deploys', { id: 5 });
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.push(gridItem('constructor', { x: 0, y: 16, w: 12, h: 8 }));
        d.layout.spec.items.push(gridItem('toString', { x: 12, y: 16, w: 12, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 2 panels
Counts: 2 added, 0 changed, 0 removed, 0 moved

+ Added Panel "Builds"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]

+ Added Panel "Deploys"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};
