import { DataQuery, TimeRange, ExplorePanelsState } from '@grafana/data';

export interface PanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface SerializedExploreState {
  queries: DataQuery[];
  datasourceUid?: string;
  range: TimeRange;
  refreshInterval?: string;
  panelsState?: ExplorePanelsState;
  compact?: boolean;
}

export interface ExploreMapPanel {
  id: string;
  exploreId: string;
  position: PanelPosition;
  exploreState?: SerializedExploreState;
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
  uid?: string;
  title?: string;
  viewport: CanvasViewport;
  panels: Record<string, ExploreMapPanel>;
  selectedPanelIds: string[];
  nextZIndex: number;
  cursors: Record<string, UserCursor>;
}

export const initialExploreMapState: ExploreMapState = {
  uid: undefined,
  title: undefined,
  viewport: {
    zoom: 1,
    // Center the viewport at canvas center (5000, 5000)
    // The pan values are offsets, so we need to calculate based on viewport size
    // At zoom 1, we want canvas position 5000 to be at screen center
    // Initial position assumes typical viewport of ~1920x1080
    panX: -4040, // -(5000 - 1920/2) = -4040
    panY: -4460, // -(5000 - 1080/2) = -4460
  },
  panels: {},
  selectedPanelIds: [],
  nextZIndex: 1,
  cursors: {},
};
