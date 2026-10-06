import { type PanelRuntimeTransformations } from '../../PanelChrome/PanelContext';

export interface TableRowTransformations {
  api: PanelRuntimeTransformations;
  owner: string;
  frameKey: string;
}
