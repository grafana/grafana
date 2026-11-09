import {
  annotation,
  builtInAnnotation,
  customVariable,
  dashboardLink,
  edit,
  panelSpecOf,
  query,
  queryVariable,
  text,
} from '../builders';
import { gridDashboard, rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const baseline = gridDashboard();

export const noChanges: ReviewCorpusCase = {
  name: 'no changes',
  input: { mode: 'save', baselineKind: 'saved', baseline, payload: edit(baseline, () => {}) },
  expected: text`
No changes to save
`,
};

export const renamedAndRenamedBack: ReviewCorpusCase = {
  name: 'shows nothing when a panel is renamed and renamed back',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(
      edit(baseline, (d) => {
        panelSpecOf(d, 'panel-1').title = 'Something else';
      }),
      (d) => {
        panelSpecOf(d, 'panel-1').title = 'Requests';
      }
    ),
  },
  expected: text`
No changes to save
`,
};

const bookkeepingOnlyBaseline = gridDashboard({ revision: 3 });

// Panel ids and the plugin revision stamp are internal: they are claimed as bookkeeping and never shown.
export const bookkeepingOnly: ReviewCorpusCase = {
  name: 'bookkeeping only: panel id renumbered, revision bumped',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: bookkeepingOnlyBaseline,
    payload: edit(bookkeepingOnlyBaseline, (d) => {
      d.revision = 4;
      d.elements['panel-3'].spec.id = 7;
    }),
  },
  expected: text`
No changes to save
`,
};

const dashboardPropertiesBaseline = gridDashboard({ tags: ['prod', 'staging'] });

export const dashboardProperties: ReviewCorpusCase = {
  name: 'dashboard properties: title, description added, tags, editable, preload, live now, graph tooltip',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: dashboardPropertiesBaseline,
    payload: edit(dashboardPropertiesBaseline, (d) => {
      d.title = 'API service overview';
      d.description = 'Golden signals for the public API';
      d.tags = ['prod', 'slo'];
      d.editable = false;
      d.preload = true;
      d.liveNow = true;
      d.cursorSync = 'Crosshair';
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 1 added, 6 changed, 1 removed, 0 moved

Dashboard was updated (8 changes) · properties
  [Properties]
    Title: "Service overview" → "API service overview"
    Description: set to "Golden signals for the public API"
    - Tag "staging"
    + Tag "slo"
    Editable: turned off
    Preload panels: turned on
    Refresh live dashboards: turned on
    Graph tooltip: Default → Shared crosshair
`,
};

const timeRangeAndRefreshBaseline = gridDashboard();

export const timeRangeAndRefresh: ReviewCorpusCase = {
  name: 'default time range and auto refresh changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: timeRangeAndRefreshBaseline,
    payload: edit(timeRangeAndRefreshBaseline, (d) => {
      d.timeSettings.from = 'now-24h';
      d.timeSettings.autoRefresh = '1m';
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 0 added, 2 changed, 0 removed, 0 moved

Dashboard was updated (2 changes) · controls
  [Controls]
    Default time range: Last 6 hours → Last 24 hours
    Auto refresh: Off → 1m
`,
};

const variablesByNameBaseline = gridDashboard({
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
    baseline: variablesByNameBaseline,
    payload: edit(variablesByNameBaseline, (d) => {
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
    baseline: variablesByNameBaseline,
    payload: edit(variablesByNameBaseline, (d) => {
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
      Description: set to "Where the service runs"
      Include All option: turned on
`,
};

const withEnv = rowsDashboard();

export const variableRenamed: ReviewCorpusCase = {
  name: 'describes a renamed variable as a removal and an addition',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: withEnv,
    payload: edit(withEnv, (d) => {
      d.variables = [customVariable('environment', ['prod', 'staging'])];
    }),
  },
  expected: text`
Changes to the dashboard
Counts: 1 added, 0 changed, 1 removed, 0 moved

Dashboard was updated (2 changes) · controls
  [Controls]
    - Custom variable "env"
      · Current value: "prod"
      · Query: "prod,staging"
    + Custom variable "environment"
      · Current value: "prod"
      · Query: "prod,staging"
`,
};

const annotationsAndLinksBaseline = gridDashboard({
  annotations: [builtInAnnotation(), annotation('Deploys', { iconColor: 'blue' })],
});

export const annotationsAndLinks: ReviewCorpusCase = {
  name: 'annotation turned off, annotation added, dashboard link added',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: annotationsAndLinksBaseline,
    payload: edit(annotationsAndLinksBaseline, (d) => {
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

const overviewMixedBaseline = rowsDashboard();

export const overviewMixed: ReviewCorpusCase = {
  name: 'changes across the dashboard, two rows and four panels (overview and ordering)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: overviewMixedBaseline,
    payload: edit(overviewMixedBaseline, (d) => {
      d.title = 'Service overview (v2)';
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.hideHeader = true;
        d.layout.spec.rows[1].spec.collapse = true;
      }
      d.elements['panel-1'].spec.title = 'Request rate';
      panelSpecOf(d, 'panel-2').transparent = true;
      panelSpecOf(d, 'panel-3').data.spec.queries.push(query('B', 'pg_stat_activity_count'));
      panelSpecOf(d, 'panel-4').data.spec.queryOptions.maxDataPoints = 500;
    }),
  },
  expected: text`
Changes to the dashboard and 2 rows
Counts: 1 added, 6 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Title: "Service overview" → "Service overview (v2)"

Row "API" was updated (1 change) · properties
  [Properties]
    Hide row header: turned on
  Panel "Request rate" was updated (1 change) · properties
    [Properties]
      Title: "Requests" → "Request rate"
  Panel "Errors" was updated (1 change) · properties
    [Properties]
      Transparent background: turned on

Row "DB" was updated (1 change) · properties
  [Properties]
    Row: collapsed
  Panel "Queries" was updated (1 change) · data
    [Data]
      + Query "B"
        · Data source: prometheus-main
        · Editor mode: code
        · Query text: pg_stat_activity_count
        · Legend format: "__auto"
        · Range: Yes
  Panel "Connections" was updated (1 change) · data
    [Data]
      Max data points: set to 500
`,
};

const metadataOnlyBaseline = gridDashboard();

export const folderMoved: ReviewCorpusCase = {
  name: 'metadata only: folder moved',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: metadataOnlyBaseline,
    payload: edit(metadataOnlyBaseline, () => {}),
    metadata: { folder: { before: 'General', after: 'Ops' } },
  },
  expected: text`
Counts: 0 added, 1 changed, 0 removed, 0 moved

Metadata (1)
  Folder: General → Ops
`,
};

export const predefinedVariablesChanged: ReviewCorpusCase = {
  name: 'metadata only: predefined variables changed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: metadataOnlyBaseline,
    payload: edit(metadataOnlyBaseline, () => {}),
    metadata: { predefinedVariables: { before: 'None', after: 'All / All' } },
  },
  expected: text`
Counts: 0 added, 1 changed, 0 removed, 0 moved

Metadata (1)
  Predefined variables: None → All / All
`,
};
