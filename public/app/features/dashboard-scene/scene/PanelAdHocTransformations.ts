import { type DataFrame, type DataTransformerConfig } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type PanelRuntimeTransformations } from '@grafana/ui';

interface PanelAdHocTransformations {
  api: PanelRuntimeTransformations;
  activeOwners: Set<string>;
}

const panels = new WeakMap<VizPanel, PanelAdHocTransformations>();

/** Tracks transformation owners used through panel context so panel edit can promote their view-only state. */
export function getPanelAdHocTransformations(panel: VizPanel): PanelAdHocTransformations {
  let entry = panels.get(panel);
  if (entry) {
    return entry;
  }

  const runtime = panel.getRuntimeTransformations();
  const activeOwners = new Set<string>();
  const api: PanelRuntimeTransformations = {
    get: (owner: string): readonly DataTransformerConfig[] => runtime.get(owner),
    set: (owner: string, transformations: readonly DataTransformerConfig[]) => {
      if (transformations.length > 0) {
        activeOwners.add(owner);
      } else {
        activeOwners.delete(owner);
      }
      runtime.set(owner, transformations);
    },
    getSourceSeries: (owner: string): readonly DataFrame[] => runtime.getSourceSeries(owner),
    subscribe: (owner: string, callback: () => void) => runtime.subscribe(owner, callback),
  };
  entry = { api, activeOwners };
  panels.set(panel, entry);
  return entry;
}
