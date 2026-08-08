import { type DataQuery, type Panel } from '@grafana/schema';
import { type PanelKind, type PanelQueryKind, type TransformationKind } from '@grafana/schema/apis/notebook/v2beta1';
import { getPanelQueries } from 'app/features/dashboard/api/ResponseTransformers';

/**
 * Converts a legacy (v1) panel model — as produced by Explore's
 * buildDashboardPanelFromExploreState — into a notebook panel element (v2 shape).
 */
export function legacyPanelToNotebookPanel(panel: Panel, options?: { title?: string; subtitle?: string }): PanelKind {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- legacy Panel.targets is loosely typed
  const targets = (panel.targets ?? []) as unknown as DataQuery[];
  const datasource = panel.datasource ?? {};

  // getPanelQueries produces the dashboard-schema PanelQueryKind; the notebook
  // schema generates the identical shape in a sibling module.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical leaf type across the two schemas
  const queries = (getPanelQueries(targets, datasource) ?? []) as unknown as PanelQueryKind[];

  const transformations: TransformationKind[] = (panel.transformations ?? []).map((transformation) => ({
    kind: transformation.id,
    spec: transformation,
  }));

  return {
    kind: 'Panel',
    spec: {
      // Reassigned to a unique id when inserted into a notebook.
      id: 0,
      title: options?.title ?? panel.title ?? '',
      subtitle: options?.subtitle,
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries,
          transformations,
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: panel.type,
        version: '',
        spec: {
          options: panel.options ?? {},
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical field config shape across schema versions
          fieldConfig: (panel.fieldConfig ?? {
            defaults: {},
            overrides: [],
          }) as PanelKind['spec']['vizConfig']['spec']['fieldConfig'],
        },
      },
    },
  };
}
