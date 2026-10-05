import { type VizPanelRuntimeTransformations } from '@grafana/scenes';

export interface TableRowTransformations {
  api: VizPanelRuntimeTransformations;
  owner: string;
  frameKey: string;
}
