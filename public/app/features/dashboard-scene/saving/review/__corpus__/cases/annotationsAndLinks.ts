import { annotation, builtInAnnotation, dashboardLink, edit, text } from '../builders';
import { gridDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard({ annotations: [builtInAnnotation(), annotation('Deploys', { iconColor: 'blue' })] });

export const annotationsAndLinks: ReviewCorpusCase = {
  name: 'annotation turned off, annotation added, dashboard link added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      d.annotations[1].spec.enable = false;
      d.annotations.push(annotation('Incidents', { iconColor: 'orange' }));
      d.links.push(dashboardLink('Runbook', 'https://runbooks.example.com/api', { targetBlank: true }));
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 2 added, 1 changed, 0 removed, 0 moved

Dashboard was updated (3 changes) · controls
  [Controls]
    Annotation "Deploys" › Enabled: turned off
    + Annotation "Incidents"
      · Enabled: Yes
      · Color: orange
      · Query [Show]
    + Link "Runbook"
      · Open in new tab: Yes
      · URL: "https://runbooks.example.com/api"
`,
};
