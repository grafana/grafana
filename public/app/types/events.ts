import { PanelModel } from 'app/features/dashboard/panel_model';

export interface GraphHoverPosition extends FlotPosition {
  /** Relative Y coordinate (percent of chart height) */
  panelRelY?: number;
}

export interface FlotPosition {
  /** Global screen X coordinate */
  pageX: number;
  /** Global screen Y coordinate */
  pageY: number;
  /** x coordinate for the first X axis */
  x: number;
  /** x coordinate for the 1st X axis */
  x1?: number;
  /** y coordinate for the first Y axis */
  y: number;
  /** y coordinate for the 1st X axis */
  y1?: number;
  /** y coordinate for the 2nd X axis (if present) */
  y2?: number;
  /** Is Ctrl key pressed */
  ctrlKey?: boolean;
  /** Is meta key pressed */
  metaKey?: boolean;
}

export interface GraphHoverEvent {
  pos: GraphHoverPosition;
  panel: PanelModel;
}
