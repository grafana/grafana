import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  gridOf,
  panel,
  panelSpecOf,
  row,
  rows,
  tab,
  tabs,
  text,
} from '../builders';
import { type ReviewCorpusCase } from '../types';

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
