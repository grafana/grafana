import {
  type AnnotationQueryKind,
  type ConditionalRenderingGroupKind,
  type Spec as DashboardV2Spec,
  type PanelKind,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * Replaces null lists, and a null elements map, with empty ones, in place.
 * Older API servers stored a list that a client left out as null. Covers the
 * fields the API server's fillNilCollections fills, except autoRefreshIntervals:
 * null there means the default intervals, but an empty list means none.
 */
export function fillNullLists(spec: DashboardV2Spec): void {
  spec.annotations ??= [];
  spec.links ??= [];
  spec.tags ??= [];
  spec.variables ??= [];
  spec.elements ??= {};

  fillAnnotations(spec.annotations);
  for (const link of spec.links) {
    link.tags ??= [];
  }
  spec.variables.forEach(fillVariable);
  for (const element of Object.values(spec.elements)) {
    if (element.kind === 'Panel') {
      fillPanel(element);
    }
  }
  fillLayout(spec.layout);
}

function fillAnnotations(annotations: AnnotationQueryKind[] = []) {
  for (const annotation of annotations) {
    if (annotation.spec.filter) {
      annotation.spec.filter.ids ??= [];
    }
  }
}

function fillPanel(panel: PanelKind) {
  panel.spec.links ??= [];

  const queryGroup = panel.spec.data?.spec;
  if (queryGroup) {
    queryGroup.queries ??= [];
    queryGroup.transformations ??= [];
  }

  const fieldConfig = panel.spec.vizConfig?.spec?.fieldConfig;
  if (fieldConfig) {
    fieldConfig.overrides ??= [];
    for (const override of fieldConfig.overrides) {
      override.properties ??= [];
    }
    if (fieldConfig.defaults?.thresholds) {
      fieldConfig.defaults.thresholds.steps ??= [];
    }
  }
}

function fillVariable(variable: VariableKind) {
  switch (variable.kind) {
    case 'QueryVariable':
    case 'DatasourceVariable':
    case 'IntervalVariable':
    case 'CustomVariable':
    case 'GroupByVariable':
      variable.spec.options ??= [];
      break;
    case 'AdhocVariable':
      variable.spec.baseFilters ??= [];
      variable.spec.filters ??= [];
      variable.spec.defaultKeys ??= [];
      break;
  }
}

function fillLayout(layout?: DashboardV2Spec['layout']) {
  switch (layout?.kind) {
    case 'GridLayout':
      layout.spec.items ??= [];
      break;
    case 'AutoGridLayout':
      layout.spec.items ??= [];
      for (const item of layout.spec.items) {
        fillConditionalRendering(item.spec.conditionalRendering);
      }
      break;
    case 'RowsLayout':
      layout.spec.rows ??= [];
      for (const row of layout.spec.rows) {
        fillConditionalRendering(row.spec.conditionalRendering);
        row.spec.variables?.forEach(fillVariable);
        fillAnnotations(row.spec.annotations);
        fillLayout(row.spec.layout);
      }
      break;
    case 'TabsLayout':
      layout.spec.tabs ??= [];
      for (const tab of layout.spec.tabs) {
        fillConditionalRendering(tab.spec.conditionalRendering);
        tab.spec.variables?.forEach(fillVariable);
        fillAnnotations(tab.spec.annotations);
        fillLayout(tab.spec.layout);
      }
      break;
  }
}

function fillConditionalRendering(group?: ConditionalRenderingGroupKind) {
  if (group) {
    group.spec.items ??= [];
  }
}
