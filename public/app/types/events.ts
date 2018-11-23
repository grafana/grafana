import { PanelModel } from 'app/features/dashboard/panel_model';

export interface GraphHoverPosition {
  pageX: number;
  pageY?: number;
  x: number;
  x1?: number;
  y?: number;
  y1?: number;
  y2?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  panelRelY?: number;
}

export interface GraphHoverEvent {
  pos: GraphHoverPosition;
  panel: PanelModel;
}
