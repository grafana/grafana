/**
 * @alpha
 */
export enum FrameGeometrySourceMode {
  Auto = 'auto', // Will scan fields and find best match
  Geohash = 'geohash',
  Coords = 'coords', // lon field, lat field
  Lookup = 'lookup', // keys > location
  // H3 = 'h3',
  // WKT = 'wkt,
  // geojson? geometry text
}

/**
 * @alpha
 */
export interface FrameGeometrySource {
  mode: FrameGeometrySourceMode;

  // Field mappings
  geohash?: string;
  latitude?: string;
  longitude?: string;
  h3?: string;
  wkt?: string;
  lookup?: string;

  // Path to Gazetteer
  gazetteer?: string;
}

/**
 * This gets saved in panel json
 *
 * depending on the type, it may have additional config
 *
 * This exists in `grafana/data` so the types are well known and extendable but the
 * layout/frame is control by the map panel
 *
 * @alpha
 */
export interface MapLayerOptions<TConfig = any> {
  type: string;
  name?: string; // configured display name

  // Custom options depending on the type
  config?: TConfig;

  // Common method to define geometry fields
  location?: FrameGeometrySource;

  // Common properties:
  // https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html
  // Layer opacity (0-1)
  opacity?: number;
}
