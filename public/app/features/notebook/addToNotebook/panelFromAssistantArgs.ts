import { type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';

import { legacyPanelToNotebookPanel } from './legacyPanelToNotebookPanel';

export interface AssistantPanelArgs {
  /** Panel title shown above the visualization. */
  title?: string;
  /** Visualization plugin id, e.g. "timeseries", "table", "stat". Defaults to "timeseries". */
  vizType?: string;
  /** Datasource uid the queries run against. */
  datasourceUid?: string;
  /** Datasource type, e.g. "prometheus", "loki". */
  datasourceType?: string;
  /** Datasource-specific query objects (e.g. { expr: "up" } for Prometheus). refId is assigned when missing. */
  queries?: Array<Record<string, unknown>>;
}

/**
 * Builds a notebook panel element from the loosely-typed arguments the assistant
 * passes to the exposed `notebooks.appendPanel` function.
 */
export function panelFromAssistantArgs(args: AssistantPanelArgs): PanelKind {
  const targets = (args.queries ?? []).map((query, index) => ({
    refId: typeof query.refId === 'string' && query.refId ? query.refId : String.fromCharCode(65 + index),
    ...query,
  }));

  const legacyPanel = {
    type: args.vizType || 'timeseries',
    title: args.title ?? 'Assistant panel',
    datasource: {
      type: args.datasourceType,
      uid: args.datasourceUid,
    },
    targets,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- synthesized legacy panel matching the loose legacy Panel shape
  return legacyPanelToNotebookPanel(legacyPanel as never, {
    title: legacyPanel.title,
    subtitle: 'Added by Assistant',
  });
}
