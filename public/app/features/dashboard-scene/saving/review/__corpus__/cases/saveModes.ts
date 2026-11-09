import {
  autoGrid,
  autoGridItem,
  customVariable,
  dashboard,
  edit,
  elements,
  gridOf,
  panel,
  panelSpecOf,
  text,
} from '../builders';
import { gridDashboard } from '../fixtures';
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

const baseline = gridDashboard({ description: 'Golden signals for the public API', tags: ['prod', 'api'] });

// The Save As form gives the copy a new title and description and doesn't copy tags by default.
export const saveAsCopy: ReviewCorpusCase = {
  name: 'Save As copy: new title and description, tags dropped',
  input: {
    mode: 'saveAsCopy',
    baselineKind: 'saved',
    sourceTitle: 'Service overview',
    baseline,
    payload: edit(baseline, (d) => {
      d.title = 'Service overview Copy';
      d.description = 'Copy for the checkout team';
      d.tags = [];
    }),
  },
  expected: text`
Copy of "Service overview"
Changes to the dashboard
Counts: 0 added, 2 changed, 2 removed, 0 moved

Dashboard was updated (4 changes) · properties
  [Properties]
    Title: "Service overview" → "Service overview Copy"
    Description: "Golden signals for the public API" → "Copy for the checkout team"
    - Tag "prod"
    - Tag "api"
`,
};

const original = gridDashboard();

export const saveAsCopyUndefinedDescription: ReviewCorpusCase = {
  name: 'ignores an undefined description in a Save As payload, as getSaveAsModel builds it',
  input: {
    mode: 'saveAsCopy',
    baselineKind: 'saved',
    sourceTitle: original.title,
    baseline: original,
    payload: {
      ...edit(original, (d) => {
        panelSpecOf(d, 'panel-1').title = 'Requests 2';
      }),
      title: 'Service overview Copy',
      description: undefined,
      tags: [],
    },
  },
  expected: text`
Copy of "Service overview"
Changes to the dashboard and 1 panel
Counts: 0 added, 2 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Title: "Service overview" → "Service overview Copy"

Panel "Requests 2" was updated (1 change) · properties
  [Properties]
    Title: "Requests" → "Requests 2"
`,
};

const pendingBaseline = gridDashboard();

export const pendingChangesBaseline: ReviewCorpusCase = {
  name: 'baseline is a recorded pending change',
  input: {
    mode: 'save',
    baselineKind: 'pendingChanges',
    baseline: pendingBaseline,
    payload: edit(pendingBaseline, (d) => {
      d.elements['panel-3'].spec.title = 'p95 latency';
    }),
  },
  expected: text`
Baseline: pending changes
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "p95 latency" was updated (1 change) · properties
  [Properties]
    Title: "Latency" → "p95 latency"
`,
};

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
