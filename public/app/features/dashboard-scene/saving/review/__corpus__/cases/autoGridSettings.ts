import { autoGrid, autoGridItem, dashboard, edit, elements, panel, text } from '../builders';
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
