import { edit, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

export const rowSettings: ReviewCorpusCase = {
  name: 'row header hidden, repeat set, collapsed, conditional rendering rules added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind !== 'RowsLayout') {
        return;
      }
      const api = d.layout.spec.rows[0].spec;
      api.hideHeader = true;
      api.repeat = { mode: 'variable', value: 'env' };
      api.collapse = true;
      api.conditionalRendering = {
        kind: 'ConditionalRenderingGroup',
        spec: {
          condition: 'and',
          items: [
            {
              kind: 'ConditionalRenderingVariable',
              spec: { operator: 'equals', value: 'prod', variable: 'env' },
            },
          ],
          visibility: 'show',
        },
      };
    }),
  },
  expected: text`
Changes to 1 section
Counts: 1 added, 3 changed, 0 removed, 0 moved

Row "API" was updated (4 changes) · properties, repeat, conditional rendering
  [Properties]
    Hide row header: turned on
    Row: collapsed
  [Repeat]
    Repeat by variable: set to env
  [Conditional rendering]
    Conditional rendering: added
      before: (none)
      after: Row visibility: Show
        Match rules: Match all
        Template variable "env": Equals "prod"
`,
};
