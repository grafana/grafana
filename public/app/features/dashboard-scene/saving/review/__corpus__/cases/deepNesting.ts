import { dashboard, edit, elements, gridOf, panel, row, rows, tab, tabs, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

const baseline = dashboard({
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
    baseline,
    payload: edit(baseline, (d) => {
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
