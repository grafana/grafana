import {
  defaultAutoGridLayoutKind,
  defaultGridLayoutKind,
  defaultRowsLayoutKind,
  defaultSpec,
  defaultTabsLayoutKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * The baseline a brand-new dashboard is compared against: the schema defaults with nothing in it,
 * and an empty layout of the payload's root kind, so everything the dashboard contains reads as an addition.
 */
export function emptyBaselineFor(payload: DashboardV2Spec): DashboardV2Spec {
  return {
    ...defaultSpec(),
    title: '',
    elements: {},
    variables: [],
    annotations: [],
    links: [],
    tags: [],
    layout: emptyLayoutOfKind(payload.layout.kind),
  };
}

function emptyLayoutOfKind(kind: DashboardV2Spec['layout']['kind']): DashboardV2Spec['layout'] {
  switch (kind) {
    case 'RowsLayout':
      return { ...defaultRowsLayoutKind(), spec: { rows: [] } };
    case 'TabsLayout':
      return { ...defaultTabsLayoutKind(), spec: { tabs: [] } };
    case 'AutoGridLayout': {
      // What the serializer writes for an auto grid at its defaults: settings at their default are left out.
      const { maxColumnCount, columnWidthMode, rowHeightMode } = defaultAutoGridLayoutKind().spec;
      return { kind: 'AutoGridLayout', spec: { maxColumnCount, columnWidthMode, rowHeightMode, items: [] } };
    }
    case 'GridLayout':
    default:
      return { ...defaultGridLayoutKind(), spec: { items: [] } };
  }
}
