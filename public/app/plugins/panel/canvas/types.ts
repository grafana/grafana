import { CanvasConnection } from '../../../features/canvas';
import { ElementState } from '../../../features/canvas/runtime/element';

import { ConnectionCoordinates } from './panelcfg.gen';

export enum LayerActionID {
  Delete = 'delete',
  Duplicate = 'duplicate',
  MoveTop = 'move-top',
  MoveBottom = 'move-bottom',
}

export interface DragNode {
  key: number;
  dataRef: ElementState;
}

export interface DropNode extends DragNode {
  pos: string;
}

export enum InlineEditTabs {
  ElementManagement = 'element-management',
  SelectedElement = 'selected-element',
  SelectedConnection = 'selected-connection',
}

export type AnchorPoint = {
  x: number;
  y: number;
};

export interface CanvasTooltipPayload {
  anchorPoint: AnchorPoint | undefined;
  element: ElementState | undefined;
  isOpen?: boolean;
}

export interface ConnectionState {
  index: number; // array index from the source
  source: ElementState;
  target: ElementState;
  info: CanvasConnection;
  vertices?: ConnectionCoordinates[];
  sourceOriginal?: ConnectionCoordinates;
  targetOriginal?: ConnectionCoordinates;
}

export enum LineStyle {
  Solid = 'solid',
  Dashed = 'dashed',
  Dotted = 'dotted',
}

export enum StrokeDasharray {
  Solid = '0',
  Dashed = '8 8',
  Dotted = '3',
}
