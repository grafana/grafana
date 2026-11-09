import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  grid,
  gridItem,
  gridOf,
  panel,
  row,
  rows,
  tab,
  tabs,
  text,
} from '../builders';
import { gridDashboard, rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1 })],
    ['panel-2', panel('Errors', { id: 2 })],
    ['panel-3', panel('Latency', { id: 3 })]
  ),
  layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2'), autoGridItem('panel-3')]),
});

export const autoGridSettings: ReviewCorpusCase = {
  name: 'auto grid settings changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.maxColumnCount = 4;
        d.layout.spec.columnWidthMode = 'wide';
      }
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 2 changed, 0 removed, 0 moved

Dashboard was updated (2 changes) · layout
  [Layout]
    Max columns: 3 → 4
    Column width: standard → wide
`,
};

const gridItemRemovedFromMiddleBaseline = gridDashboard();

// 'Latency' keeps its place on the grid but moves from index 2 to index 1 of the items array.
export const gridItemRemovedFromMiddle: ReviewCorpusCase = {
  name: 'grid item removed from the middle (index shift is not a change to other panels)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: gridItemRemovedFromMiddleBaseline,
    payload: edit(gridItemRemovedFromMiddleBaseline, (d) => {
      delete d.elements['panel-2'];
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.splice(1, 1);
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Panel "Errors"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]
`,
};

const panelMovedBetweenRowsBaseline = rowsDashboard();

export const panelMovedBetweenRows: ReviewCorpusCase = {
  name: 'panel moved between rows',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: panelMovedBetweenRowsBaseline,
    payload: edit(panelMovedBetweenRowsBaseline, (d) => {
      if (d.layout.kind !== 'RowsLayout') {
        return;
      }
      const [api, db] = d.layout.spec.rows;
      if (api.spec.layout.kind === 'GridLayout' && db.spec.layout.kind === 'GridLayout') {
        api.spec.layout.spec.items.splice(1, 1);
        db.spec.layout.spec.items.push(gridItem('panel-2', { x: 0, y: 8, w: 12, h: 8 }));
      }
    }),
  },
  expected: text`
Changes to 2 rows
Counts: 0 added, 0 changed, 0 removed, 1 moved

Row "DB"
  Panel "Errors" moved from Row "API" to Row "DB", after Panel "Connections"
`,
};

const movesGrid = gridDashboard();

// 'Latency' slides right but stays after 'Errors' in reading order: a position change, not a move.
export const panelPositionOnly: ReviewCorpusCase = {
  name: 'panel position changed, reading order unchanged',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: movesGrid,
    payload: edit(movesGrid, (d) => {
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items[2] = gridItem('panel-3', { x: 12, y: 8, w: 12, h: 8 });
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Latency" was updated (1 change) · layout
  [Layout]
    Position: moved right
`,
};

const auto = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1 })],
    ['panel-2', panel('Errors', { id: 2 })],
    ['panel-3', panel('Latency', { id: 3 })]
  ),
  layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2'), autoGridItem('panel-3')]),
});

// Only 'Latency' left the common order; 'Requests' and 'Errors' merely shifted down one place.
export const panelMovedToFirst: ReviewCorpusCase = {
  name: 'panel moved to the first place in its section (relative to the next panel)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: auto,
    payload: edit(auto, (d) => {
      d.layout = autoGrid([autoGridItem('panel-3'), autoGridItem('panel-1'), autoGridItem('panel-2')]);
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 0 changed, 0 removed, 1 moved

Panel "Latency" moved before Panel "Requests"
`,
};

const tabbed = dashboard({
  elements: elements(['panel-1', panel('CPU usage', { id: 1 })], ['panel-2', panel('Memory usage', { id: 2 })]),
  layout: tabs([tab('CPU', gridOf('panel-1')), tab('Memory', gridOf('panel-2'))]),
});

export const sectionsReordered: ReviewCorpusCase = {
  name: 'tabs reordered (one tab moved, no "order changed" line)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabbed,
    payload: edit(tabbed, (d) => {
      if (d.layout.kind === 'TabsLayout') {
        d.layout.spec.tabs.reverse();
      }
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 0 added, 0 changed, 0 removed, 1 moved

Tab "Memory" moved before Tab "CPU"
`,
};

const twoTabs = dashboard({
  elements: elements(
    ['panel-1', panel('P1', { id: 1 })],
    ['panel-2', panel('P2', { id: 2 })],
    ['panel-3', panel('P3', { id: 3 })]
  ),
  layout: tabs([tab('Tab 1', gridOf('panel-1', 'panel-2')), tab('Tab 2', gridOf('panel-3'))]),
});

// A move between sections names where it came from and where it went.
export const panelMovedBetweenTabs: ReviewCorpusCase = {
  name: 'panel moved to another tab: both ends named',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoTabs,
    payload: edit(twoTabs, (d) => {
      d.layout = tabs([tab('Tab 1', gridOf('panel-1', 'panel-2', 'panel-3')), tab('Tab 2', gridOf())]);
    }),
  },
  expected: text`
Changes to 2 tabs
Counts: 0 added, 0 changed, 0 removed, 1 moved

Tab "Tab 1"
  Panel "P3" moved from Tab "Tab 2" to Tab "Tab 1", after Panel "P2"
`,
};

const twoRows = rowsDashboard();

export const panelsSwappedBetweenRows: ReviewCorpusCase = {
  name: 'describes two panels swapped between rows as two moves',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoRows,
    payload: edit(twoRows, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        const [api, db] = d.layout.spec.rows;
        api.spec.layout = gridOf('panel-3', 'panel-2');
        db.spec.layout = gridOf('panel-1', 'panel-4');
      }
    }),
  },
  expected: text`
Changes to 2 rows
Counts: 0 added, 0 changed, 0 removed, 2 moved

Row "API"
  Panel "Queries" moved from Row "DB" to Row "API", before Panel "Errors"

Row "DB"
  Panel "Requests" moved from Row "API" to Row "DB", before Panel "Connections"
`,
};

const panelPositionAndSizeBaseline = gridDashboard();

// The grid keeps its items sorted by position, so moving 'Errors' below 'Latency' also reorders the array.
// Its reading order changed, so it reads as a move next to its new neighbour rather than as a position.
export const panelPositionAndSize: ReviewCorpusCase = {
  name: 'panel moved below another panel and resized within a grid',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: panelPositionAndSizeBaseline,
    payload: edit(panelPositionAndSizeBaseline, (d) => {
      d.layout = grid([
        gridItem('panel-1', { x: 0, y: 0, w: 12, h: 8 }),
        gridItem('panel-3', { x: 0, y: 8, w: 12, h: 8 }),
        gridItem('panel-2', { x: 0, y: 16, w: 24, h: 8 }),
      ]);
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 1 moved

Panel "Errors" moved after Panel "Latency" and was updated (1 change) · layout
  [Layout]
    Size: wider
      before: 12 × 8
      after: 24 × 8
`,
};

const rowsToTabsBaseline = rowsDashboard();

// Every panel ends up under a new kind of section, but nothing moved: one layout entry, no per-panel moves.
export const rowsToTabs: ReviewCorpusCase = {
  name: 'rows converted to tabs (one layout entry)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: rowsToTabsBaseline,
    payload: edit(rowsToTabsBaseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout = tabs(d.layout.spec.rows.map((r) => tab(r.spec.title, r.spec.layout)));
      }
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Layout: changed from rows to tabs
`,
};

/*
 * A layout change that puts existing panels or sections into new ones (grouping into rows or tabs) doesn't
 * mark them moved: the layout line accounts for them. The new section's header counts them and lists them,
 * one level deep, so the review still says where they went.
 */

const fourPanels = elements(
  ['panel-1', panel('P1', { id: 1 })],
  ['panel-2', panel('P2', { id: 2 })],
  ['panel-3', panel('P3', { id: 3 })],
  ['panel-4', panel('P4', { id: 4 })]
);

const tabOfFour = dashboard({
  elements: fourPanels,
  layout: tabs([
    tab('Tab 1', autoGrid(['panel-1', 'panel-2', 'panel-3', 'panel-4'].map((name) => autoGridItem(name)))),
  ]),
});

/** Grouped into rows, then a new row and one panel dragged into it. */
export const groupedIntoRowsThenMovedToNewRow: ReviewCorpusCase = {
  name: 'tab grouped into rows, then a panel dragged into a second new row',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabOfFour,
    payload: edit(tabOfFour, (d) => {
      d.layout = tabs([
        tab(
          'Tab 1',
          rows([
            row('New row', autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2'), autoGridItem('panel-4')])),
            row('New row 1', autoGrid([autoGridItem('panel-3')])),
          ])
        ),
      ]);
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 2 added, 1 changed, 0 removed, 0 moved

Tab "Tab 1" was updated (1 change) · layout
  [Layout]
    Layout: changed from auto grid to rows
  + Added Row "New row" (3 panels moved to it)
    • Panel "P1"
    • Panel "P2"
    • Panel "P4"
  + Added Row "New row 1" (1 panel moved to it)
    • Panel "P3"
`,
};

const gridOfTwo = dashboard({
  elements: elements(['panel-1', panel('P1', { id: 1 })], ['panel-2', panel('P2', { id: 2 })]),
  layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2')]),
});

export const gridGroupedIntoTabs: ReviewCorpusCase = {
  name: 'dashboard grid grouped into tabs, one panel in each',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: gridOfTwo,
    payload: edit(gridOfTwo, (d) => {
      d.layout = tabs([
        tab('New tab', autoGrid([autoGridItem('panel-1')])),
        tab('New tab 1', autoGrid([autoGridItem('panel-2')])),
      ]);
    }),
  },
  expected: text`
Changes to the dashboard and 2 tabs
Counts: 2 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Layout: changed from auto grid to tabs

+ Added Tab "New tab" (1 panel moved to it)
  • Panel "P1"

+ Added Tab "New tab 1" (1 panel moved to it)
  • Panel "P2"
`,
};

const movedInByLayoutChangeTwoRows = dashboard({
  elements: elements(['panel-1', panel('P1', { id: 1 })], ['panel-2', panel('P2', { id: 2 })]),
  layout: rows([row('API', autoGrid([autoGridItem('panel-1')])), row('DB', autoGrid([autoGridItem('panel-2')]))]),
});

export const rowsGroupedIntoTab: ReviewCorpusCase = {
  name: 'rows grouped into a new tab',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: movedInByLayoutChangeTwoRows,
    payload: edit(movedInByLayoutChangeTwoRows, (d) => {
      d.layout = tabs([tab('New tab', movedInByLayoutChangeTwoRows.layout)]);
    }),
  },
  expected: text`
Changes to the dashboard and 1 tab
Counts: 1 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Layout: changed from rows to tabs

+ Added Tab "New tab" (2 rows moved to it)
  · Layout: rows
  • Row "API"
  • Row "DB"
`,
};

export const newPanelAlongsideMovedIn: ReviewCorpusCase = {
  name: 'tab grouped into rows, with a brand-new panel in the new row',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabOfFour,
    payload: edit(tabOfFour, (d) => {
      d.elements['panel-5'] = panel('P5', { id: 5 });
      d.layout = tabs([
        tab(
          'Tab 1',
          rows([
            row(
              'New row',
              autoGrid(['panel-1', 'panel-2', 'panel-3', 'panel-4', 'panel-5'].map((name) => autoGridItem(name)))
            ),
          ])
        ),
      ]);
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 2 added, 1 changed, 0 removed, 0 moved

Tab "Tab 1" was updated (1 change) · layout
  [Layout]
    Layout: changed from auto grid to rows
  + Added Row "New row" (4 panels moved to it, 1 panel added)
    • Panel "P1"
    • Panel "P2"
    • Panel "P3"
    • Panel "P4"
    + Added Panel "P5"
      · Visualization: timeseries
      · Queries (1) [Show]
      · Plugin options [Show]
      · Field config [Show]
`,
};

/** A moved-in panel that also changed is listed once, as its own collapsible line, in its place in the list. */
export const movedInPanelAlsoChanged: ReviewCorpusCase = {
  name: 'tab grouped into rows, a panel dragged into a second new row and changed there',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabOfFour,
    payload: edit(tabOfFour, (d) => {
      d.elements['panel-4'] = panel('P4', { id: 4, transparent: true });
      d.layout = tabs([
        tab(
          'Tab 1',
          rows([
            row('New row', autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2')])),
            row('New row 1', autoGrid([autoGridItem('panel-3'), autoGridItem('panel-4')])),
          ])
        ),
      ]);
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 2 added, 2 changed, 0 removed, 0 moved

Tab "Tab 1" was updated (1 change) · layout
  [Layout]
    Layout: changed from auto grid to rows
  + Added Row "New row" (2 panels moved to it)
    • Panel "P1"
    • Panel "P2"
  + Added Row "New row 1" (2 panels moved to it)
    • Panel "P3"
    Panel "P4" was updated (1 change) · properties
      [Properties]
        Transparent background: turned on
`,
};

/*
 * The auto grid serializer writes a setting only when it differs from the default, so "absent" is a value:
 * `matchRowHeights` absent means on, layout `fitContent` absent means off, and an item's `fitContent`
 * absent means "follow the layout".
 */

function autoGridDashboard(settings: Parameters<typeof autoGrid>[1] = {}) {
  return dashboard({
    elements: elements(
      ['panel-1', panel('Requests', { id: 1 })],
      ['panel-2', panel('Errors', { id: 2 })],
      ['panel-3', panel('Latency', { id: 3 })]
    ),
    layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2'), autoGridItem('panel-3')], settings),
  });
}

const matchingHeights = autoGridDashboard();

export const matchRowHeightsTurnedOff: ReviewCorpusCase = {
  name: 'auto grid: match row heights turned off (absent means on)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: matchingHeights,
    payload: edit(matchingHeights, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.matchRowHeights = false;
      }
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Match row heights: turned off
`,
};

const notMatchingHeights = autoGridDashboard({ matchRowHeights: false });

export const matchRowHeightsTurnedOn: ReviewCorpusCase = {
  name: 'auto grid: match row heights turned back on (written as absent)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: notMatchingHeights,
    payload: edit(notMatchingHeights, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        delete d.layout.spec.matchRowHeights;
      }
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Match row heights: turned on
`,
};

const fittingContent = autoGridDashboard({ fitContent: true });

export const itemFitContentOverridden: ReviewCorpusCase = {
  name: "auto grid: a panel's fit content overridden (turned off while the layout fits content)",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: fittingContent,
    payload: edit(fittingContent, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.items[1].spec.fitContent = false;
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · layout
  [Layout]
    Fit content: turned off
`,
};

const itemOverride = edit(fittingContent, (d) => {
  if (d.layout.kind === 'AutoGridLayout') {
    d.layout.spec.items[1].spec.fitContent = false;
  }
});

// Removing the override doesn't turn anything off: the panel follows the layout again.
export const itemFitContentInherited: ReviewCorpusCase = {
  name: "auto grid: a panel's fit content override removed (follows the layout again)",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: itemOverride,
    payload: edit(itemOverride, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        delete d.layout.spec.items[1].spec.fitContent;
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · layout
  [Layout]
    Fit content: set to follow the layout
`,
};

const unknownLayoutKindBaseline = gridDashboard();

// A layout kind from a newer Grafana: name it from its kind rather than leave the line blank,
// and don't read its panels as removed just because the layout can't be walked.
export const unknownLayoutKind: ReviewCorpusCase = {
  name: 'unknown root layout kind replaces the grid',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: unknownLayoutKindBaseline,
    payload: edit(unknownLayoutKindBaseline, (d) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      d.layout = { ...d.layout, kind: 'FancyLayout' } as unknown as DashboardV2Spec['layout'];
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Layout: changed from custom grid to Fancy layout
`,
};
