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
      · Current value: "prod"
      · Query: "prod,staging"
    + Annotation "Annotations & Alerts"
      · Built in: Yes
      · Enabled: Yes
      · Hidden: Yes
      · Color: rgba(0, 211, 255, 1)
      · Query [Show]

+ Added Panel "Orders"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]

+ Added Panel "Payment errors"
  · Visualization: timeseries
  · Queries (1) [Show]
  · Plugin options [Show]
  · Field config [Show]

System defaults (1)
  Dashboard
    Refresh live dashboards: turned off
`,
};
