import { autoGrid, autoGridItem, dashboard, edit, elements, panel, row, rows, tab, tabs, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

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

const twoRows = dashboard({
  elements: elements(['panel-1', panel('P1', { id: 1 })], ['panel-2', panel('P2', { id: 2 })]),
  layout: rows([row('API', autoGrid([autoGridItem('panel-1')])), row('DB', autoGrid([autoGridItem('panel-2')]))]),
});

export const rowsGroupedIntoTab: ReviewCorpusCase = {
  name: 'rows grouped into a new tab',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoRows,
    payload: edit(twoRows, (d) => {
      d.layout = tabs([tab('New tab', twoRows.layout)]);
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
