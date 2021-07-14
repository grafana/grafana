import { MapLayerConfig } from '@grafana/data';
import Units from 'ol/proj/Units';
import { MapCenterID } from './view';

export interface ControlsOptions {
  // Zoom (upper left)
  showZoom?: boolean;

  // let the mouse wheel zoom
  mouseWheelZoom?: boolean;

  // Add legend control
  showLegend?: boolean;

  // Lower right
  showAttribution?: boolean;

  // Scale options
  showScale?: boolean;
  scaleUnits?: Units;

  // Show debug
  showDebug?: boolean;
}

export interface MapCenterConfig {
  id: string; // placename > lookup
  lat?: number;
  lon?: number;
}

export interface MapViewConfig {
  center: MapCenterConfig;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  shared?: boolean;
}

export const defaultView: MapViewConfig = {
  center: {
    id: MapCenterID.Zero,
  },
  zoom: 1,
};

export interface GeomapPanelOptions {
  view: MapViewConfig;
  controls: ControlsOptions;
  basemap: MapLayerConfig;
  layers: MapLayerConfig[];
  fieldMapping: FieldMappingOptions;
}

export interface FieldMappingOptions {
  metricField: string;
  geohashField: string;
  latitudeField: string;
  longitudeField: string;
}

export interface QueryFormat {
  locationType: string;
}
