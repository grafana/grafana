import OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { EventBus, GrafanaTheme2, MapLayerOptions } from '@grafana/data';

import { xyzTiles, XYZConfig } from './generic';

describe('XYZ tile layer noRepeat functionality', () => {
  let mockMap: OpenLayersMap;
  let mockEventBus: EventBus;
  let mockTheme: GrafanaTheme2;

  beforeEach(() => {
    mockMap = {} as OpenLayersMap;
    mockEventBus = {} as EventBus;
    mockTheme = {} as GrafanaTheme2;
  });

  it('should set wrapX to false when noRepeat is true', async () => {
    const options: MapLayerOptions<XYZConfig> = {
      name: 'Test Layer',
      type: 'xyz',
      config: {
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: 'Test Attribution',
      },
      noRepeat: true,
    };

    const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source).toBeInstanceOf(XYZ);
    expect(source.getWrapX()).toBe(false);
  });

  it('should set wrapX to true when noRepeat is false', async () => {
    const options: MapLayerOptions<XYZConfig> = {
      name: 'Test Layer',
      type: 'xyz',
      config: {
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: 'Test Attribution',
      },
      noRepeat: false,
    };

    const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source).toBeInstanceOf(XYZ);
    expect(source.getWrapX()).toBe(true);
  });

  it('should set wrapX to true when noRepeat is undefined (defaults to false)', async () => {
    const options: MapLayerOptions<XYZConfig> = {
      name: 'Test Layer',
      type: 'xyz',
      config: {
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: 'Test Attribution',
      },
      // noRepeat not specified
    };

    const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source).toBeInstanceOf(XYZ);
    expect(source.getWrapX()).toBe(true);
  });

  it('should preserve other layer properties when noRepeat is set', async () => {
    const options: MapLayerOptions<XYZConfig> = {
      name: 'Test Layer',
      type: 'xyz',
      config: {
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: 'Test Attribution',
        minZoom: 2,
        maxZoom: 18,
      },
      noRepeat: true,
    };

    const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getMinZoom()).toBe(2);
    expect(layer.getMaxZoom()).toBe(18);

    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source.getWrapX()).toBe(false);
  });
});
