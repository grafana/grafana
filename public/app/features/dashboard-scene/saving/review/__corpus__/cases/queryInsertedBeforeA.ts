import { edit, panelSpecOf, query, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

// Inserting at index 0 makes the raw diff replace every field of index 0 and add index 1;
// queries are identified by ref ID, so only B is new.
export const queryInsertedBeforeA: ReviewCorpusCase = {
  name: 'query inserted before A, matched by ref ID',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queries.unshift(query('B', 'rate(http_requests_total{status=~"5.."}[5m])'));
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    + Query "B"
      · Data source: prometheus-main
      · Editor mode: code
      · Query text: rate(http_requests_total{status=~"5.."}[5m])
      · Legend format: "__auto"
      · Range: Yes
`,
};
