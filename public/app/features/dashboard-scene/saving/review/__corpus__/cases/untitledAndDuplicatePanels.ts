import { dashboard, edit, elements, gridOf, panel, panelSpecOf, tab, tabs, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

const baseline = dashboard({
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
    baseline,
    payload: edit(baseline, (d) => {
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
