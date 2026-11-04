import { edit, panelSpecOf, query, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const queryAppended: ReviewCorpusCase = {
  name: 'query appended',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries.push(query('B', 'rate(http_requests_total{status=~"5.."}[5m])'));
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    + Query "B"
`,
};
