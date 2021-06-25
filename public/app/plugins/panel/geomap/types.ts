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

export interface GeomapPanelOptions {
  controls: ControlsOptions;
  basemap: MapLayerConfig; // auto
  // layers: MapLayerConfig[]; // empty == auto
}
