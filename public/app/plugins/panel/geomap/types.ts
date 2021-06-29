import { MapLayerConfig } from '@grafana/data';
import Units from 'ol/proj/Units';

export interface ControlsOptions {
  // Zoom (upper left)
  showZoom?: boolean;

  // Lower right
  showAttribution?: boolean;

  // Scale options
  showScale?: boolean;
  scaleUnits?: Units;
  scaleMinWidth?: number;
  scaleShowBar?: boolean;

  // Overview (same map for now)
  showOverview?: boolean;
}

export interface MapViewConfig {
  centerLat: number;
  centerLng: number;
  zoomLevel: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface GeomapPanelOptions {
  view: MapViewConfig;
  controls: ControlsOptions;
  basemap: MapLayerConfig; // auto
  // layers: MapLayerConfig[]; // empty == auto
}
