import { edit, libraryPanel, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

// Turning a panel into a library panel replaces its whole element: its queries and visualization now live
// in the library panel, so they are part of that one change rather than a list of removals.
export const libraryPanelCreated: ReviewCorpusCase = {
  name: 'panel converted to a library panel',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['panel-2'] = libraryPanel('Errors', 'Shared errors', 'lib-errors', 2);
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · properties
  [Properties]
    Converted to library panel "Shared errors"
`,
};
