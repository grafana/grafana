import { autoGrid, autoGridItem, dashboard, elements, panel, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

// An auto grid left at its default settings: nothing about the layout's settings is new to describe.
export const newDashboardAutoGrid: ReviewCorpusCase = {
  name: 'new dashboard with a default auto grid: no layout setting lines',
  input: {
    mode: 'new',
    baselineKind: 'saved',
    baseline: null,
    payload: dashboard({
      title: 'Checkout',
      elements: elements(['panel-1', panel('Orders', { id: 1 })], ['panel-2', panel('Payment errors', { id: 2 })]),
      layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2')]),
    }),
  },
  expected: text`
New dashboard
The dashboard and 2 panels
Counts: 4 added, 0 changed, 0 removed, 0 moved

Dashboard · properties, controls
  [Properties]
    Title: set to "Checkout"
  [Controls]
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
