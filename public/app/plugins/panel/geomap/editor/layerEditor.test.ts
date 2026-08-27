import { type BaseLayer } from 'ol/layer';

import {
  FrameGeometrySourceMode,
  type MapLayerHandler,
  type MapLayerOptions,
  type MapLayerRegistryItem,
} from '@grafana/data';

import { type MapLayerState } from '../types';

import { getLayerEditor } from './layerEditor';

// The real registry pulls in basemaps -> maplibre -> ol-mapbox-style, which is untransformed
// ESM under jest. Only `getIfExists` is exercised by the code under test (the type-switch
// handler), so stand in fake layers carrying just the properties that handler reads.
const fakeLayers: Record<string, MapLayerRegistryItem> = {
  markers: { id: 'markers', name: 'Markers', showLocation: true, defaultOptions: {}, create: jest.fn() },
  route: { id: 'route', name: 'Route', showLocation: true, defaultOptions: {}, create: jest.fn() },
  geojson: { id: 'geojson', name: 'GeoJSON', defaultOptions: {}, create: jest.fn() },
  wkt: {
    id: 'wkt',
    name: 'WKT',
    showLocation: true,
    locationModes: [FrameGeometrySourceMode.Wkt],
    defaultOptions: {},
    create: jest.fn(),
  },
};
jest.mock('../layers/registry', () => ({
  DEFAULT_BASEMAP_CONFIG: { type: 'default', name: '', config: {} },
  geomapLayerRegistry: { getIfExists: (id: string) => fakeLayers[id] },
  getLayersOptions: jest.fn().mockReturnValue({ options: [], current: [] }),
}));

function buildState(options: MapLayerOptions): { state: MapLayerState; onChange: jest.Mock } {
  const onChange = jest.fn();
  const handler: MapLayerHandler = { init: () => ({}) as BaseLayer };
  const state: MapLayerState = {
    options,
    handler,
    layer: {} as BaseLayer,
    onChange,
  };
  return { state, onChange };
}

function changeType(options: MapLayerOptions, newType: string) {
  const { state, onChange } = buildState(options);
  const editor = getLayerEditor({ state, category: ['Layer'], basemaps: false });
  editor.values({} as never).onChange('type', newType);
  return onChange.mock.calls[0]?.[0] as MapLayerOptions | undefined;
}

describe('getLayerEditor type switch', () => {
  it('forces the single implied location mode when switching to a WKT-only layer, discarding any previous field', () => {
    const opts = changeType(
      {
        type: 'markers',
        name: 'x',
        location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
      },
      'wkt'
    );
    expect(opts?.location).toEqual({ mode: FrameGeometrySourceMode.Wkt });
  });

  it('defaults to Auto when switching to a location-aware layer with no prior location configured', () => {
    const opts = changeType({ type: 'geojson', name: 'x' }, 'markers');
    expect(opts?.location).toEqual({ mode: FrameGeometrySourceMode.Auto });
  });

  it('clears the location entirely when switching between two multi-mode layers that already had a mode set', () => {
    const opts = changeType(
      {
        type: 'markers',
        name: 'x',
        location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
      },
      'route'
    );
    expect(opts?.location).toBeUndefined();
  });
});
