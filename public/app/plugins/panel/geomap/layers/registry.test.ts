jest.mock('ol-mapbox-style', () => ({}));
jest.mock('geotiff', () => ({}));

jest.mock('app/core/config', () => ({
  ...jest.requireActual('app/core/config'),
  hasAlphaPanels: true,
}));

import { getLayersOptions } from './registry';

/** Layer types named in geomap docs — data layers plus common basemap sources. */
const DOCUMENTED_DATA_LAYER_IDS = [
  'markers',
  'heatmap',
  'geojson',
  'dynamic-geojson',
  'dayNight',
  'route',
  'photos',
  'network',
  'last-point-tracker',
] as const;

const DOCUMENTED_BASEMAP_IDS = ['osm-standard', 'carto', 'xyz', 'esri-xyz', 'maplibre'] as const;

describe('geomapLayerRegistry options', () => {
  it('should expose documented data and overlay layer types in the combined layer picker', () => {
    const { options } = getLayersOptions(false);
    const ids = new Set(options.map((o) => o.value));

    expect(DOCUMENTED_DATA_LAYER_IDS.every((id) => ids.has(id))).toBe(true);
  });

  it('should expose documented basemap types when editing the basemap layer', () => {
    const { options } = getLayersOptions(true);
    const ids = new Set(options.map((o) => o.value));

    expect(ids.has('default')).toBe(true);
    expect(DOCUMENTED_BASEMAP_IDS.every((id) => ids.has(id))).toBe(true);
  });
});
