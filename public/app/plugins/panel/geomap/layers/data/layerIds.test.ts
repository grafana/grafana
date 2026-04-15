jest.mock('geotiff', () => ({}));

import { FrameGeometrySourceMode } from '@grafana/schema';

import { DAY_NIGHT_LAYER_ID } from './dayNightLayer';
import { dynamicGeoJSONLayer } from './geojsonDynamic';
import { geojsonLayer } from './geojsonLayer';
import { heatmapLayer } from './heatMap';
import { lastPointTracker } from './lastPointTracker';
import { MARKERS_LAYER_ID, defaultMarkersConfig } from './markersLayer';
import { NETWORK_LAYER_ID } from './networkLayer';
import { PHOTOS_LAYER_ID } from './photosLayer';
import { ROUTE_LAYER_ID } from './routeLayer';

describe('geomap data layer identifiers', () => {
  it('should use stable layer type ids for documented data layers', () => {
    expect(MARKERS_LAYER_ID).toBe('markers');
    expect(heatmapLayer.id).toBe('heatmap');
    expect(geojsonLayer.id).toBe('geojson');
    expect(dynamicGeoJSONLayer.id).toBe('dynamic-geojson');
    expect(DAY_NIGHT_LAYER_ID).toBe('dayNight');
    expect(ROUTE_LAYER_ID).toBe('route');
    expect(PHOTOS_LAYER_ID).toBe('photos');
    expect(NETWORK_LAYER_ID).toBe('network');
    expect(lastPointTracker.id).toBe('last-point-tracker');
  });

  it('should default markers layer config to auto location and tooltips enabled', () => {
    expect(defaultMarkersConfig.type).toBe('markers');
    expect(defaultMarkersConfig.location?.mode).toBe(FrameGeometrySourceMode.Auto);
    expect(defaultMarkersConfig.tooltip).toBe(true);
  });
});
