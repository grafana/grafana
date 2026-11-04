import { dashboard, edit, elements, gridOf, panel, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

// jsonDiff escapes the '/' in the key as '~1'; claims must use the escaped form to match.
const baseline = dashboard({
  elements: elements(['api/errors', panel('Errors', { id: 1 })], ['api/latency', panel('Latency', { id: 2 })]),
  layout: gridOf('api/errors', 'api/latency'),
});

export const elementKeyWithSlash: ReviewCorpusCase = {
  name: "element key containing '/'",
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.elements['api/errors'].spec.title = 'Error rate';
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Error rate" was updated (1 change) · properties
  [Properties]
    Title: "Errors" → "Error rate"
`,
};
