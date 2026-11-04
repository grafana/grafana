import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

// A layout kind from a newer Grafana: name it from its kind rather than leave the line blank,
// and don't read its panels as removed just because the layout can't be walked.
export const unknownLayoutKind: ReviewCorpusCase = {
  name: 'unknown root layout kind replaces the grid',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      d.layout = { ...d.layout, kind: 'FancyLayout' } as unknown as DashboardV2Spec['layout'];
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · layout
  [Layout]
    Layout: changed from custom grid to Fancy layout
`,
};
