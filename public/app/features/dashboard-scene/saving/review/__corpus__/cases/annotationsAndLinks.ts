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
      before: (none)
      after: {
          "kind": "AnnotationQuery",
          "spec": {
            "builtIn": false,
            "enable": true,
            "hide": false,
            "iconColor": "orange",
            "name": "Incidents",
            "query": {
              "datasource": {
                "name": "prometheus-main"
              },
              "group": "prometheus",
              "kind": "DataQuery",
              "spec": {},
              "version": "v0"
            }
          }
        }
    + Link "Runbook"
      before: (none)
      after: {
          "asDropdown": false,
          "icon": "",
          "includeVars": false,
          "keepTime": false,
          "tags": [],
          "targetBlank": true,
          "title": "Runbook",
          "tooltip": "",
          "type": "link",
          "url": "https://runbooks.example.com/api"
        }
`,
};
