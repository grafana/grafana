// ol-mapbox-style and geotiff fail to parse under jest; stub them so the real
// layer registry (and everything it transitively imports) can still load.
jest.mock('ol-mapbox-style', () => ({}));
jest.mock('geotiff', () => ({}));

import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import { type Attribution } from 'ol/source/Source';
import XYZ from 'ol/source/XYZ';

import { type MapLayerHandler, type MapLayerOptions } from '@grafana/data';

import { geomapLayerRegistry } from '../layers/registry';
import { type MapLayerState } from '../types';

import { captureLayerAttribution, updateAttributionVisibility } from './attribution';

const getIfExists = jest.spyOn(geomapLayerRegistry, 'getIfExists');

const frameState = {} as Parameters<Attribution>[0];

const tileLayer = (attributions?: string) =>
  new TileLayer({ source: new XYZ({ url: 'http://x/{z}/{x}/{y}', attributions }) });

const attributionOf = (layer: TileLayer<XYZ>) => {
  const attributions = layer.getSource()?.getAttributions();
  return attributions ? attributions(frameState) : null;
};

const layerState = (layer: MapLayerState['layer'], options: Partial<MapLayerOptions> = {}): MapLayerState => ({
  options: { name: 'Basemap', type: 'xyz', ...options },
  layer,
  handler: {} as MapLayerHandler,
  onChange: jest.fn(),
  getName: () => 'Basemap',
});

const optional = { id: 'xyz', name: 'XYZ', create: jest.fn() };
const required = { id: 'carto', name: 'CARTO', create: jest.fn(), requiresAttribution: true };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateAttributionVisibility', () => {
  it('hides attribution when the map control is off', () => {
    getIfExists.mockReturnValue(optional);
    const layer = tileLayer('© Tiles');
    captureLayerAttribution(layer);

    updateAttributionVisibility([layerState(layer)], { showAttribution: false });

    expect(attributionOf(layer)).toBeNull();
  });

  it('keeps required attribution when the map control is off', () => {
    getIfExists.mockReturnValue(required);
    const layer = tileLayer('©CARTO');
    captureLayerAttribution(layer);

    updateAttributionVisibility([layerState(layer, { type: 'carto' })], { showAttribution: false });

    expect(attributionOf(layer)).toEqual(['©CARTO']);
  });

  it('asks the layer type when the requirement depends on the configuration', () => {
    const requiresAttribution = jest.fn((cfg: MapLayerOptions) => cfg.config?.server !== 'custom');
    getIfExists.mockReturnValue({ id: 'esri-xyz', name: 'ArcGIS', create: jest.fn(), requiresAttribution });
    const preset = tileLayer('© ArcGIS');
    const custom = tileLayer('© Mine');
    captureLayerAttribution(preset);
    captureLayerAttribution(custom);

    updateAttributionVisibility(
      [
        layerState(preset, { type: 'esri-xyz', config: { server: 'topo' } }),
        layerState(custom, { type: 'esri-xyz', config: { server: 'custom' } }),
      ],
      { showAttribution: false }
    );

    expect(attributionOf(preset)).toEqual(['© ArcGIS']);
    expect(attributionOf(custom)).toBeNull();
  });

  it('shows attribution by default', () => {
    getIfExists.mockReturnValue(optional);
    const layer = tileLayer('© Tiles');
    captureLayerAttribution(layer);

    updateAttributionVisibility([layerState(layer)]);

    expect(attributionOf(layer)).toEqual(['© Tiles']);
  });

  it('restores attribution that it hid earlier', () => {
    getIfExists.mockReturnValue(optional);
    const layer = tileLayer('© Tiles');
    captureLayerAttribution(layer);

    updateAttributionVisibility([layerState(layer)], { showAttribution: false });
    updateAttributionVisibility([layerState(layer)], { showAttribution: true });

    expect(attributionOf(layer)).toEqual(['© Tiles']);
  });

  it('reaches the sources inside a layer group', () => {
    getIfExists.mockReturnValue(optional);
    const child = tileLayer('© Tiles');
    const group = new LayerGroup({ layers: [child] });
    captureLayerAttribution(group);

    updateAttributionVisibility([layerState(group)], { showAttribution: false });

    expect(attributionOf(child)).toBeNull();
  });

  it('leaves attribution that arrives after the layer was created', () => {
    getIfExists.mockReturnValue(required);
    const layer = tileLayer();
    captureLayerAttribution(layer);

    layer.getSource()?.setAttributions('© Style');
    updateAttributionVisibility([layerState(layer, { type: 'maplibre' })], { showAttribution: false });

    expect(attributionOf(layer)).toEqual(['© Style']);
  });
});
