import { customVariable, dashboard, elements, gridOf, panel, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

export const newDashboard: ReviewCorpusCase = {
  name: 'new dashboard: everything reads as an addition',
  input: {
    mode: 'new',
    baselineKind: 'saved',
    baseline: null,
    payload: dashboard({
      title: 'Checkout',
      tags: ['team-a'],
      variables: [customVariable('env', ['prod', 'staging'])],
      elements: elements(['panel-1', panel('Orders', { id: 1 })], ['panel-2', panel('Payment errors', { id: 2 })]),
      layout: gridOf('panel-1', 'panel-2'),
    }),
  },
  expected: text`
New dashboard
The dashboard and 2 panels
Counts: 6 added, 0 changed, 0 removed, 0 moved

Dashboard · properties, controls
  [Properties]
    Title: set to "Checkout"
    + Tag "team-a"
  [Controls]
    + Custom variable "env"
      before: (none)
      after: {
          "kind": "CustomVariable",
          "spec": {
            "allowCustomValue": true,
            "current": {
              "text": "prod",
              "value": "prod"
            },
            "hide": "dontHide",
            "includeAll": false,
            "multi": false,
            "name": "env",
            "query": "prod,staging",
            "skipUrlSync": false
          }
        }
    + Annotation "Annotations & Alerts"
      before: (none)
      after: {
          "kind": "AnnotationQuery",
          "spec": {
            "builtIn": true,
            "enable": true,
            "hide": true,
            "iconColor": "rgba(0, 211, 255, 1)",
            "name": "Annotations & Alerts",
            "query": {
              "datasource": {
                "name": "-- Grafana --"
              },
              "group": "grafana",
              "kind": "DataQuery",
              "spec": {},
              "version": "v0"
            }
          }
        }

+ Panel "Orders"

+ Panel "Payment errors"

System defaults (1)
  Dashboard
    Refresh live dashboards: turned off
`,
};
