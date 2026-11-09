import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import nestedDashboardJson from '../../../../serialization/testfiles/nested_dashboard.json';
import {
  autoGrid,
  autoGridItem,
  customVariable,
  dashboard,
  edit,
  elements,
  gridOf,
  type Layout,
  normalize,
  panel,
  panelSpecOf,
  row,
  rows,
  tab,
  tabs,
  text,
} from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

// Rows have no ID: same position and the same panels make it the same row with a new title.
export const rowRenamed: ReviewCorpusCase = {
  name: 'row renamed (matched by position and panels)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.title = 'API v2';
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 1 changed, 0 removed, 0 moved

Row "API v2" was updated (1 change) · properties
  [Properties]
    Title: "API" → "API v2"
`,
};

export const rowRenamedWithPanelAdded: ReviewCorpusCase = {
  name: 'matches a renamed row by position when a panel was also added to it',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-9'] = panel('Saturation', { id: 9 });
      if (d.layout.kind === 'RowsLayout') {
        const [api] = d.layout.spec.rows;
        api.spec.title = 'Gateway';
        api.spec.layout = gridOf('panel-1', 'panel-2', 'panel-9');
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 1 added, 1 changed, 0 removed, 0 moved

Row "Gateway" was updated (1 change) · properties
  [Properties]
    Title: "API" → "Gateway"
  + Added Panel "Saturation"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`,
};

export const rowRenamedKeepingFewPanels: ReviewCorpusCase = {
  name: 'treats a renamed row that kept fewer than half of its panels as removed and added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-8'] = panel('Saturation', { id: 8 });
      d.elements['panel-9'] = panel('Utilization', { id: 9 });
      if (d.layout.kind === 'RowsLayout') {
        const [api, db] = d.layout.spec.rows;
        api.spec.title = 'Gateway';
        api.spec.layout = gridOf('panel-1', 'panel-8', 'panel-9');
        db.spec.layout = gridOf('panel-3', 'panel-4', 'panel-2');
      }
    }),
  },
  expected: text`
Changes to 3 rows
Counts: 3 added, 0 changed, 1 removed, 2 moved

- Removed Row "API"
  · Layout: custom grid

+ Added Row "Gateway" (2 panels added)
  · Layout: custom grid
  Panel "Requests" moved from Row "API" to Row "Gateway", before Panel "Saturation"
  + Added Panel "Saturation"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
  + Added Panel "Utilization"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]

Row "DB"
  Panel "Errors" moved from Row "API" to Row "DB", after Panel "Connections"
`,
};

const rowRemovedWithPanelsBaseline = rowsDashboard();

export const rowRemovedWithPanels: ReviewCorpusCase = {
  name: 'row removed with its panels',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: rowRemovedWithPanelsBaseline,
    payload: edit(rowRemovedWithPanelsBaseline, (d) => {
      delete d.elements['panel-3'];
      delete d.elements['panel-4'];
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows.pop();
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Removed Row "DB"
  · Layout: custom grid
  removed with it: Panel "Queries"
  removed with it: Panel "Connections"
`,
};

const rowAddedBaseline = rowsDashboard();

export const rowAdded: ReviewCorpusCase = {
  name: 'row added with a new panel',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: rowAddedBaseline,
    payload: edit(rowAddedBaseline, (d) => {
      d.elements['panel-5'] = panel('Hit rate', { id: 5 });
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows.push(row('Cache', gridOf('panel-5')));
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 2 added, 0 changed, 0 removed, 0 moved

+ Added Row "Cache" (1 panel added)
  · Layout: custom grid
  + Added Panel "Hit rate"
    · Visualization: timeseries
    · Queries (1) [Show]
    · Plugin options [Show]
    · Field config [Show]
`,
};

const rowSettingsBaseline = rowsDashboard();

export const rowSettings: ReviewCorpusCase = {
  name: 'row header hidden, repeat set, collapsed, conditional rendering rules added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: rowSettingsBaseline,
    payload: edit(rowSettingsBaseline, (d) => {
      if (d.layout.kind !== 'RowsLayout') {
        return;
      }
      const api = d.layout.spec.rows[0].spec;
      api.hideHeader = true;
      api.repeat = { mode: 'variable', value: 'env' };
      api.collapse = true;
      api.conditionalRendering = {
        kind: 'ConditionalRenderingGroup',
        spec: {
          condition: 'and',
          items: [
            {
              kind: 'ConditionalRenderingVariable',
              spec: { operator: 'equals', value: 'prod', variable: 'env' },
            },
          ],
          visibility: 'show',
        },
      };
    }),
  },
  expected: text`
Changes to 1 row
Counts: 1 added, 3 changed, 0 removed, 0 moved

Row "API" was updated (4 changes) · properties, repeat, conditional rendering
  [Properties]
    Hide row header: turned on
    Row: collapsed
  [Repeat]
    Repeat by variable: set to env
  [Conditional rendering]
    Conditional rendering: added (1 rule)
      · Row visibility: Show
      · Match rules: Match all
      · Template variable "env": Equals "prod"
`,
};

export const rowCollapsed: ReviewCorpusCase = {
  name: 'lists a collapsed row under Properties',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: rowSettingsBaseline,
    payload: edit(rowSettingsBaseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[1].spec.collapse = true;
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 1 changed, 0 removed, 0 moved

Row "DB" was updated (1 change) · properties
  [Properties]
    Row: collapsed
`,
};

const sectionVariablesBaseline = rowsDashboard();

export const sectionVariables: ReviewCorpusCase = {
  name: 'variable added to a row',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: sectionVariablesBaseline,
    payload: edit(sectionVariablesBaseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.variables = [customVariable('endpoint', ['/orders', '/payments'])];
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 1 added, 0 changed, 0 removed, 0 moved

Row "API" was updated (1 change) · controls
  [Controls]
    + Custom variable "endpoint"
      · Current value: "/orders"
      · Query: "/orders,/payments"
`,
};

const deepNestingBaseline = dashboard({
  title: 'Kubernetes',
  elements: elements(
    ['panel-1', panel('CPU', { id: 1 })],
    ['panel-2', panel('Memory', { id: 2 })],
    ['panel-3', panel('Restarts', { id: 3 })],
    ['panel-4', panel('Throughput', { id: 4 })]
  ),
  layout: tabs([
    tab(
      'Cluster',
      rows([row('Nodes', tabs([tab('Details', gridOf('panel-1', 'panel-2'))])), row('Pods', gridOf('panel-3'))])
    ),
    tab('Network', gridOf('panel-4')),
  ]),
});

// The sections above 'Details' have nothing of their own to show, so 'Details' says where it sits.
export const deepNesting: ReviewCorpusCase = {
  name: 'deep nesting (tab › row › tab, full path in the header)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: deepNestingBaseline,
    payload: edit(deepNestingBaseline, (d) => {
      d.elements['panel-1'].spec.title = 'CPU usage';
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 0 added, 1 changed, 0 removed, 0 moved

Tab "Details" under Tab "Cluster" › Row "Nodes"
  Panel "CPU usage" was updated (1 change) · properties
    [Properties]
      Title: "CPU" → "CPU usage"
`,
};

// JSON imports type kinds as plain strings.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const nested = normalize(nestedDashboardJson as unknown as DashboardV2Spec);

export const nestedDashboardUnchanged: ReviewCorpusCase = {
  name: 'real dashboard: nested rows and tabs has no changes against itself',
  input: { mode: 'save', baselineKind: 'saved', baseline: nested, payload: edit(nested, () => {}) },
  expected: text`
No changes to save
`,
};

export const nestedDashboardEdited: ReviewCorpusCase = {
  name: 'real dashboard: nested rows and tabs describes a rename, a move between nested tabs, a removed nested row and a renamed empty tab',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: nested,
    payload: edit(nested, (d) => {
      panelSpecOf(d, 'panel-4').title = 'Renamed';
      delete d.elements['panel-6'];
      // The fixture's nesting is deeper than the builders' types follow; walk it as plain JSON.
      const layout = JSON.parse(JSON.stringify(d.layout));
      const [credit, cpu] = layout.spec.rows;
      const [creditUsage, ec2CreditUsage] = credit.spec.layout.spec.rows;
      creditUsage.spec.layout.spec.tabs[1].spec.title = 'us-west-1';
      ec2CreditUsage.spec.layout.spec.rows = [];
      const [cw, testData] = cpu.spec.layout.spec.rows[0].spec.layout.spec.tabs;
      cw.spec.layout.spec.items = [];
      testData.spec.layout.spec.items.push(autoGridItem('panel-12'));
      d.layout = layout;
    }),
  },
  expected: text`
Changes to 2 rows
Counts: 0 added, 2 changed, 1 removed, 1 moved

Tab "us-east-1" under Row "Credit" › Row "Credit Usage"
  Panel "Renamed" was updated (1 change) · properties
    [Properties]
      Title: "EC2 Credit Usage for one instance" → "Renamed"

Tab "us-west-1" under Row "Credit" › Row "Credit Usage" was updated (1 change) · properties
  [Properties]
    Title: "us-east-2" → "us-west-1"

- Removed Row "duplicated CPU" under Row "Credit" › Row "EC2 credit usage"
  · Layout: custom grid
  removed with it: Panel "EC2 Credit Usage for one instance"

Tab "tab with test data" under Row "CPU" › Row "GF-ds"
  Panel "GF datasource" moved from Row "CPU" › Row "GF-ds" › Tab "CW" to Row "CPU" › Row "GF-ds" › Tab "tab with test data", after Panel "random 1"
`,
};

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

const untitledAndDuplicateSectionsBaseline = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1 })],
    ['panel-2', panel('Queries', { id: 2 })],
    ['panel-3', panel('Logs', { id: 3 })]
  ),
  layout: rows([
    row('Backend', gridOf('panel-1')),
    row('Backend', gridOf('panel-2')),
    row(undefined, gridOf('panel-3')),
  ]),
});

export const untitledAndDuplicateSections: ReviewCorpusCase = {
  name: 'untitled and duplicate-titled rows named by position',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: untitledAndDuplicateSectionsBaseline,
    payload: edit(untitledAndDuplicateSectionsBaseline, (d) => {
      panelSpecOf(d, 'panel-2').transparent = true;
      panelSpecOf(d, 'panel-3').transparent = true;
    }),
  },
  expected: text`
Changes to 2 rows
Counts: 0 added, 2 changed, 0 removed, 0 moved

Row "Backend" at position 2
  Panel "Queries" was updated (1 change) · properties
    [Properties]
      Transparent background: turned on

Row (unnamed)
  Panel "Logs" was updated (1 change) · properties
    [Properties]
      Transparent background: turned on
`,
};

const emptyAndMissingTitles = dashboard({
  elements: elements(['panel-1', panel('A', { id: 1 })], ['panel-2', panel('B', { id: 2 })]),
  layout: rows([row('', gridOf('panel-1')), row(undefined, gridOf('panel-2'))]),
});

export const emptyAndMissingRowTitles: ReviewCorpusCase = {
  name: 'names rows with an empty and a missing title alike, by position',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: emptyAndMissingTitles,
    payload: edit(emptyAndMissingTitles, (d) => {
      panelSpecOf(d, 'panel-1').title = 'A2';
      panelSpecOf(d, 'panel-2').title = 'B2';
    }),
  },
  expected: text`
Changes to 2 rows
Counts: 0 added, 2 changed, 0 removed, 0 moved

Row (unnamed) at position 1
  Panel "A2" was updated (1 change) · properties
    [Properties]
      Title: "A" → "A2"

Row (unnamed) at position 2
  Panel "B2" was updated (1 change) · properties
    [Properties]
      Title: "B" → "B2"
`,
};
