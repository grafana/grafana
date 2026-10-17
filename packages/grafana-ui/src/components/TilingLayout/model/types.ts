export type Axis = 'x' | 'y';
export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export type ViewParams = Record<string, unknown>;

/** Serializable description of one view (a tab). */
export interface ViewRecord<P extends object = ViewParams> {
  title?: string;
  /** Free-form type tag consumers can use to pick what to render. */
  type?: string;
  params?: P;
}

export interface SplitNode {
  kind: 'split';
  id: string;
  axis: Axis;
  /** Relative sizes of the children, same length as children. */
  weights: number[];
  children: LayoutNode[];
}

/** A tab group holding one or more views. */
export interface PanelNode {
  kind: 'panel';
  id: string;
  views: string[];
  selected: string;
}

export type LayoutNode = SplitNode | PanelNode;

export interface FloatingPanel {
  panel: PanelNode;
  /** Position and size in fractions (0-1) of the workspace. */
  rect: Rect;
  /** Stacking order, higher is in front. */
  z: number;
}

export type RestoreTarget =
  | { kind: 'beside'; nodeId: string; side: Side; share: number }
  | { kind: 'floating'; rect: Rect }
  | { kind: 'tab'; panelId: string; index: number }
  | { kind: 'root' };

export interface HiddenPanel {
  panel: PanelNode;
  restore: RestoreTarget;
}

/** The complete, serializable state of a tiling layout. */
export interface LayoutDocument {
  root: LayoutNode | null;
  floating: FloatingPanel[];
  hidden: HiddenPanel[];
  views: Record<string, ViewRecord>;
}

export type PanelRegion = 'docked' | 'floating' | 'hidden';

export interface LayoutMetrics {
  gap: number;
  tabBarHeight: number;
  minPanelWidth: number;
  minPanelHeight: number;
}

/** Where a dragged panel or view lands. */
export type DropTarget =
  | { kind: 'tab'; panelId: string; index: number }
  | { kind: 'edge'; panelId: string; side: Side }
  | { kind: 'seam'; splitId: string; axis: Axis; prevId?: string; nextId?: string }
  | { kind: 'frame'; side: Side }
  | { kind: 'root' }
  | { kind: 'float'; rect: Rect };
