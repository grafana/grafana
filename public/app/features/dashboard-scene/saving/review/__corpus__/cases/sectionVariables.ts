import { customVariable, edit, text } from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = rowsDashboard();

export const sectionVariables: ReviewCorpusCase = {
  name: 'variable added to a row',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.variables = [customVariable('endpoint', ['/orders', '/payments'])];
      }
    }),
  },
  expected: text`
Changes to 1 section
Counts: 1 added, 0 changed, 0 removed, 0 moved

Row "API" was updated (1 change) · controls
  [Controls]
    + Custom variable "endpoint"
      before: (none)
      after: {
          "kind": "CustomVariable",
          "spec": {
            "allowCustomValue": true,
            "current": {
              "text": "/orders",
              "value": "/orders"
            },
            "hide": "dontHide",
            "includeAll": false,
            "multi": false,
            "name": "endpoint",
            "query": "/orders,/payments",
            "skipUrlSync": false
          }
        }
`,
};
