import { autoGrid, autoGridItem, dashboard, edit, elements, panel, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

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
