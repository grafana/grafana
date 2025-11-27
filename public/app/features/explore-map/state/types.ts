export interface PanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface ExploreMapPanel {
  id: string;
  exploreId: string;
  position: PanelPosition;
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface UserCursor {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  lastUpdated: number;
}

export interface ExploreMapState {
  viewport: CanvasViewport;
  panels: Record<string, ExploreMapPanel>;
  selectedPanelId?: string;
  nextZIndex: number;
  cursors: Record<string, UserCursor>;
}

export const initialExploreMapState: ExploreMapState = {
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0,
  },
  panels: {},
  selectedPanelId: undefined,
  nextZIndex: 1,
  cursors: {},
};
