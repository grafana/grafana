import { edit, panel, panelSpecOf, query, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', {
    id: 1,
    queries: [query('A', 'sum(rate(http_requests_total{job="api"}[5m]))')],
  });
});

export const queryExpressionChanged: ReviewCorpusCase = {
  name: 'query expression changed (long value, with details)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries[0].spec.query.spec.expr =
        'sum by (status) (rate(http_requests_total{job="api"}[5m]))';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    Query "A" › Query text: changed
      before: sum(rate(http_requests_total{job="api"}[5m]))
      after: sum by (status) (rate(http_requests_total{job="api"}[5m]))
`,
};
