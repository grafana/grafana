import { edit, panelSpecOf, text, transformation } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const transformationAdded: ReviewCorpusCase = {
  name: 'transformation added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      panelSpecOf(d, 'panel-1').data.spec.transformations.push(
        transformation('organize', { excludeByName: {}, indexByName: {}, renameByName: { Value: 'Requests/s' } })
      );
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 0 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    + Transformation "Organize fields by name"
      · Options [Show]
`,
};
