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
