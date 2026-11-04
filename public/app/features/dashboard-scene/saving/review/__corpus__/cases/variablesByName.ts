import { customVariable, edit, queryVariable, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard({
  variables: [
    customVariable('env', ['prod', 'staging'], { label: 'Env' }),
    customVariable('region', ['eu-west', 'us-east']),
    queryVariable('job', 'label_values(up, job)'),
  ],
});

// 'cluster' is inserted at index 0, so every other variable shifts by one index in the raw diff.
export const variablesByName: ReviewCorpusCase = {
  name: 'variables added at index 0, changed and removed, matched by name',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      const [env, , job] = d.variables;
      if (env.kind === 'CustomVariable') {
        env.spec.label = 'Environment';
      }
      d.variables = [customVariable('cluster', ['blue', 'green']), env, job];
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 1 added, 1 changed, 1 removed, 0 moved

Dashboard was updated (3 changes) · controls
  [Controls]
    + Custom variable "cluster"
      before: (none)
      after: {
          "kind": "CustomVariable",
          "spec": {
            "allowCustomValue": true,
            "current": {
              "text": "blue",
              "value": "blue"
            },
            "hide": "dontHide",
            "includeAll": false,
            "multi": false,
            "name": "cluster",
            "query": "blue,green",
            "skipUrlSync": false
          }
        }
    Custom variable "env" › Label: "Env" → "Environment"
    - Custom variable "region"
      before: {
          "kind": "CustomVariable",
          "spec": {
            "allowCustomValue": true,
            "current": {
              "text": "eu-west",
              "value": "eu-west"
            },
            "hide": "dontHide",
            "includeAll": false,
            "multi": false,
            "name": "region",
            "query": "eu-west,us-east",
            "skipUrlSync": false
          }
        }
      after: (none)
`,
};
