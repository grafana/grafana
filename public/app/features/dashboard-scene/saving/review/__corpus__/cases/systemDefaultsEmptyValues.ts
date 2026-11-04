import { edit, panelSpecOf, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

// Saved by an older Grafana that left out empty fields; the current serializer always writes them.
// An empty description is the same as none, so only the filled-in `hidden: false` is listed.
const olderSave = edit(gridDashboard(), (d) => {
  const spec: Partial<ReturnType<typeof panelSpecOf>> = panelSpecOf(d, 'panel-1');
  delete spec.description;
  const querySpec: { hidden?: boolean } = panelSpecOf(d, 'panel-1').data.spec.queries[0].spec;
  delete querySpec.hidden;
});

export const systemDefaultsEmptyValues: ReviewCorpusCase = {
  name: 'system defaults: empty values written on an unedited save',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: olderSave,
    payload: edit(olderSave, (d) => {
      const spec = panelSpecOf(d, 'panel-1');
      spec.description = '';
      spec.data.spec.queries[0].spec.hidden = false;
    }),
  },
  expected: text`
Counts: 0 added, 0 changed, 0 removed, 0 moved

System defaults (1)
  Panel "Requests"
    Query "A" › Hide response: turned off
`,
};
