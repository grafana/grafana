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
      · Current value: "blue"
      · Query: "blue,green"
    Custom variable "env" › Label: "Env" → "Environment"
    - Custom variable "region"
      · Current value: "eu-west"
      · Query: "eu-west,us-east"
`,
};

// Several fields of one variable: one line naming it, its changes listed under it.
export const variableFieldsGrouped: ReviewCorpusCase = {
  name: 'several fields of one variable changed, grouped under its name',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      const env = d.variables[0];
      if (env.kind === 'CustomVariable') {
        env.spec.label = 'Environment';
        env.spec.description = 'Where the service runs';
        env.spec.includeAll = true;
      }
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 3 changed, 0 removed, 0 moved

Dashboard was updated (3 changes) · controls
  [Controls]
    Custom variable "env" (3 changes)
      Label: "Env" → "Environment"
      Include All option: turned on
      Description: set to "Where the service runs"
`,
};
