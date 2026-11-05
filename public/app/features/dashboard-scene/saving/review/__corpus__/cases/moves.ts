import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  gridItem,
  gridOf,
  panel,
  tab,
  tabs,
  text,
} from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const grid = gridDashboard();

// 'Latency' slides right but stays after 'Errors' in reading order: a position change, not a move.
export const panelPositionOnly: ReviewCorpusCase = {
  name: 'panel position changed, reading order unchanged',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: grid,
    payload: edit(grid, (d) => {
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
