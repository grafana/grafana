import {
  autoGrid,
  autoGridItem,
  customVariable,
  dashboard,
  edit,
  elements,
  gridOf,
  type Layout,
  panel,
  row,
  rows,
  tab,
  tabs,
  text,
} from '../builders';
import { type ReviewCorpusCase } from '../types';

/*
 * Added and removed section headers at depth 1, 2 and 3, for rows and tabs. In each, the section holding
 * 'Queries' is removed and a new one holding the new 'Hit rate' panel takes its place. Sections above them
 * have nothing of their own, so they are compressed and the headers say where they sit with "under".
 */

const members = elements(
  ['panel-1', panel('Requests', { id: 1 })],
  ['panel-2', panel('Queries', { id: 2 })],
  ['panel-3', panel('Hit rate', { id: 3 })]
);

function sectionsOf(kind: 'row' | 'tab', titles: [string, string], names: [string, string]): Layout {
  return kind === 'row'
    ? rows(titles.map((title, i) => row(title, gridOf(names[i]))))
    : tabs(titles.map((title, i) => tab(title, gridOf(names[i]))));
}

/** `wrap` puts the sections at the depth under test. */
function swapCase(
  name: string,
  kind: 'row' | 'tab',
  wrap: (inner: Layout) => Layout,
  expected: string
): ReviewCorpusCase {
  const baseline = dashboard({
    elements: members,
    layout: wrap(sectionsOf(kind, ['API', 'DB'], ['panel-1', 'panel-2'])),
  });
  return {
    name,
    input: {
      mode: 'save',
      baselineKind: 'saved',
      baseline: edit(baseline, (d) => {
        delete d.elements['panel-3'];
      }),
      payload: edit(baseline, (d) => {
        delete d.elements['panel-2'];
        d.layout = wrap(sectionsOf(kind, ['API', 'Cache'], ['panel-1', 'panel-3']));
      }),
    },
    expected,
  };
}

const atRoot = (inner: Layout) => inner;
const inTab = (inner: Layout) => tabs([tab('Tab 1', inner)]);
const inRow = (inner: Layout) => rows([row('Overview', inner)]);

export const rowsSwappedAtDepth1 = swapCase(
  'added and removed rows at depth 1',
  'row',
  atRoot,
  text`
Changes to 2 rows
Counts: 2 added, 0 changed, 1 removed, 0 moved

- Removed Row "DB"
  · Layout: custom grid
  removed with it: Panel "Queries"

+ Added Row "Cache" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`
);

export const tabsSwappedAtDepth1 = swapCase(
  'added and removed tabs at depth 1',
  'tab',
  atRoot,
  text`
Changes to 2 tabs
Counts: 2 added, 0 changed, 1 removed, 0 moved

- Removed Tab "DB"
  · Layout: custom grid
  removed with it: Panel "Queries"

+ Added Tab "Cache" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`
);

export const rowsSwappedAtDepth2 = swapCase(
  'added and removed rows at depth 2 (under a compressed tab)',
  'row',
  inTab,
  text`
Changes to 1 tab
Counts: 2 added, 0 changed, 1 removed, 0 moved

- Removed Row "DB" under Tab "Tab 1"
  · Layout: custom grid
  removed with it: Panel "Queries"

+ Added Row "Cache" under Tab "Tab 1" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`
);

export const tabsSwappedAtDepth2 = swapCase(
  'added and removed tabs at depth 2 (under a compressed row)',
  'tab',
  inRow,
  text`
Changes to 1 row
Counts: 2 added, 0 changed, 1 removed, 0 moved

- Removed Tab "DB" under Row "Overview"
  · Layout: custom grid
  removed with it: Panel "Queries"

+ Added Tab "Cache" under Row "Overview" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`
);

export const rowsSwappedAtDepth3 = swapCase(
  'added and removed rows at depth 3 (full parent path)',
  'row',
  (inner) => rows([row('Region', tabs([tab('EU', inner)]))]),
  text`
Changes to 1 row
Counts: 2 added, 0 changed, 1 removed, 0 moved

- Removed Row "DB" under Row "Region" › Tab "EU"
  · Layout: custom grid
  removed with it: Panel "Queries"

+ Added Row "Cache" under Row "Region" › Tab "EU" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`
);

export const tabsSwappedAtDepth3 = swapCase(
  'added and removed tabs at depth 3 (full parent path)',
  'tab',
  (inner) => tabs([tab('Cluster', rows([row('Nodes', inner)]))]),
  text`
Changes to 1 tab
Counts: 2 added, 0 changed, 1 removed, 0 moved

- Removed Tab "DB" under Tab "Cluster" › Row "Nodes"
  · Layout: custom grid
  removed with it: Panel "Queries"

+ Added Tab "Cache" under Tab "Cluster" › Row "Nodes" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`
);

const shownParent = dashboard({
  variables: [customVariable('env', ['prod', 'staging'])],
  elements: members,
  layout: inTab(sectionsOf('row', ['API', 'DB'], ['panel-1', 'panel-2'])),
});

// 'Tab 1' has a change of its own, so it is shown and its rows sit right under it: no "under".
export const underDroppedForDirectParent: ReviewCorpusCase = {
  name: '"under" dropped when the tree parent is the direct parent',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: edit(shownParent, (d) => {
      delete d.elements['panel-3'];
    }),
    payload: edit(shownParent, (d) => {
      delete d.elements['panel-2'];
      d.layout = tabs([
        tab('Tab 1', sectionsOf('row', ['API', 'Cache'], ['panel-1', 'panel-3']), {
          repeat: { mode: 'variable', value: 'env' },
        }),
      ]);
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 2 added, 1 changed, 1 removed, 0 moved

Tab "Tab 1" was updated (1 change) · repeat
  [Repeat]
    Repeat by variable: set to env
  - Removed Row "DB"
    · Layout: custom grid
    removed with it: Panel "Queries"
  + Added Row "Cache" (1 panel added)
    · Layout: custom grid
    + Added Panel "Hit rate"
      · Visualization: timeseries
      · Queries (1) [Show]
      · Plugin options [Show]
      · Field config [Show]
`,
};

const cluster = dashboard({
  variables: [customVariable('node', ['node-1', 'node-2'])],
  elements: elements(['panel-1', panel('CPU usage', { id: 1 })], ['panel-2', panel('Disk usage', { id: 2 })]),
  layout: tabs([tab('Cluster', rows([row('Nodes', tabs([tab('CPU', gridOf('panel-1'))]))]))]),
});

// 'Cluster' is shown (it has a change), 'Nodes' isn't: the new tab sits under 'Cluster' but names its full parent path.
export const underKeptForCompressedParent: ReviewCorpusCase = {
  name: '"under" kept when an intermediate section is compressed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: edit(cluster, (d) => {
      delete d.elements['panel-2'];
    }),
    payload: edit(cluster, (d) => {
      d.layout = tabs([
        tab('Cluster', rows([row('Nodes', tabs([tab('CPU', gridOf('panel-1')), tab('Disk', gridOf('panel-2'))]))]), {
          repeat: { mode: 'variable', value: 'node' },
        }),
      ]);
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 2 added, 1 changed, 0 removed, 0 moved

Tab "Cluster" was updated (1 change) · repeat
  [Repeat]
    Repeat by variable: set to node
  + Added Tab "Disk" under Tab "Cluster" › Row "Nodes" (1 panel added)
    · Layout: custom grid
    + Added Panel "Disk usage"
      · Visualization: timeseries
      · Queries (1) [Show]
      · Plugin options [Show]
      · Field config [Show]
`,
};

const twoTabs = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1 })],
    ['panel-2', panel('Errors', { id: 2 })],
    ['panel-3', panel('A$number', { id: 3 })]
  ),
  layout: tabs([
    tab('Tab 1', autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2')])),
    tab('Tab 2', autoGrid([autoGridItem('panel-3')])),
  ]),
});

/*
 * The scenario from the app: Tab 1's auto grid becomes rows ('New row' takes over its panels, 'New row 1'
 * is added), 'New row 1' gets a nested 'Tab 2' and a 'New tab', 'A$number' moves from the old Tab 2 into the
 * nested Tab 2, and the old Tab 2 is removed.
 */
export const autoGridToRowsScenario: ReviewCorpusCase = {
  name: 'auto grid → rows with nested new sections, a panel moved into them and a tab removed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: twoTabs,
    payload: edit(twoTabs, (d) => {
      d.layout = tabs([
        tab(
          'Tab 1',
          rows([
            row('New row', autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2')])),
            row('New row 1', tabs([tab('Tab 2', autoGrid([autoGridItem('panel-3')])), tab('New tab', autoGrid([]))])),
          ])
        ),
      ]);
    }),
  },
  expected: text`
Changes to 2 tabs
Counts: 4 added, 1 changed, 1 removed, 1 moved

Tab "Tab 1" was updated (1 change) · layout
  [Layout]
    Layout: changed from auto grid to rows
  + Added Row "New row" (2 panels moved to it)
    • Panel "Requests"
    • Panel "Errors"
  + Added Row "New row 1" (2 tabs added)
    · Layout: tabs
    + Added Tab "Tab 2"
      Panel "A$number" moved from Tab "Tab 2" to Tab "Tab 1" › Row "New row 1" › Tab "Tab 2"
    + Added Tab "New tab"
      · Layout: auto grid

- Removed Tab "Tab 2"
  · Layout: auto grid
`,
};
