import { edit, panel, panelSpecOf, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = edit(gridDashboard(), (d) => {
  d.elements['panel-1'] = panel('Requests', { id: 1, queryOptions: { interval: '1m' } });
});

export const queryOptionsChanged: ReviewCorpusCase = {
  name: 'query options: max data points set, min interval changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.queryOptions = { interval: '30s', maxDataPoints: 500 };
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 2 changed, 0 removed, 0 moved

Panel "Requests" was updated (2 changes) · data
  [Data]
    Max data points: set to 500
    Min interval: 1m → 30s
`,
};
