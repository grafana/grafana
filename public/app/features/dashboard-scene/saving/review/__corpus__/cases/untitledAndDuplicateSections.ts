import { dashboard, edit, elements, gridOf, panel, panelSpecOf, row, rows, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

const baseline = dashboard({
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
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-2').transparent = true;
      panelSpecOf(d, 'panel-3').transparent = true;
    }),
  },
  expected: text`
Changes to 2 panels
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
