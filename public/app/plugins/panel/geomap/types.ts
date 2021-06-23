import { MapLayerConfig } from '@grafana/data';

export interface ControlsOptions {
  hideZoom?: boolean;
  hideAttribution?: boolean;
}

export interface GeomapPanelOptions {
  controls: ControlsOptions;
  basemaps: MapLayerConfig[]; // empty === auto
  layers: MapLayerConfig[]; // empty == auto
}
