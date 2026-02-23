import OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { EventBus, GrafanaTheme2, MapLayerOptions } from '@grafana/data';

import { xyzTiles, XYZConfig } from './generic';

const replaceMock = jest.fn((text: string) => text);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: replaceMock,
  }),
}));

describe('XYZ tile layer', () => {
  let mockMap: OpenLayersMap;
  let mockEventBus: EventBus;
  let mockTheme: GrafanaTheme2;

  beforeEach(() => {
    mockMap = {} as OpenLayersMap;
    mockEventBus = {} as EventBus;
    mockTheme = {} as GrafanaTheme2;
    replaceMock.mockClear();
  });

  it('should interpolate variables in URL and attribution', async () => {
    const rawUrl = 'https://example.com/$version/{z}/{x}/{y}.png';
    const interpolatedUrl = 'https://example.com/v1/{z}/{x}/{y}.png';
    const rawAttr = 'Map version $version';
    const interpolatedAttr = 'Map version v1';

    replaceMock.mockImplementation((text) => {
      if (text === rawUrl) {
        return interpolatedUrl;
      }
      if (text === rawAttr) {
        return interpolatedAttr;
      }
      return text;
    });

    const options: MapLayerOptions<XYZConfig> = {
      name: 'Test Layer',
      type: 'xyz',
      config: {
        url: rawUrl,
        attribution: rawAttr,
      },
    };

    const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;

    expect(replaceMock).toHaveBeenCalledWith(rawUrl);
    expect(replaceMock).toHaveBeenCalledWith(rawAttr);
    expect(source.getUrls()).toContain(interpolatedUrl);
  });

  describe('noRepeat functionality', () => {
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

      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
      expect(source.getWrapX()).toBe(true);
    });

    it('should set wrapX to true when noRepeat is undefined', async () => {
      const options: MapLayerOptions<XYZConfig> = {
        name: 'Test Layer',
        type: 'xyz',
        config: {
          url: 'https://example.com/{z}/{x}/{y}.png',
          attribution: 'Test Attribution',
        },
      };

      const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
      expect(source.getWrapX()).toBe(true);
    });
  });

  describe('zoom configuration', () => {
    it('should apply minZoom to both Layer and Source', async () => {
      const options: MapLayerOptions<XYZConfig> = {
        name: 'Zoom Test Layer',
        type: 'xyz',
        config: {
          url: 'https://example.com',
          attribution: 'Test Attribution',
          minZoom: 4,
        },
      };

      const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;

      expect(layer.getMinZoom()).toBe(4);
      expect(source.getTileGrid()?.getMinZoom()).toBe(4);
    });

    it('should apply maxZoom ONLY to Source (to enable digital zoom)', async () => {
      const options: MapLayerOptions<XYZConfig> = {
        name: 'Digital Zoom Layer',
        type: 'xyz',
        config: {
          url: 'https://example.com',
          attribution: 'Test Attribution',
          maxZoom: 18,
        },
      };

      const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;

      expect(layer.getMaxZoom()).toBe(Infinity);
      expect(source.getTileGrid()?.getMaxZoom()).toBe(18);
    });

    it('should handle undefined zoom options correctly', async () => {
      const options: MapLayerOptions<XYZConfig> = {
        name: 'Default Zoom Layer',
        type: 'xyz',
        config: {
          url: 'https://example.com',
          attribution: 'Test Attribution',
        },
      };

      const result = await xyzTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;

      expect(layer.getMinZoom()).toBe(-Infinity);
      expect(layer.getMaxZoom()).toBe(Infinity);
      expect(source.getTileGrid()?.getMinZoom()).toBe(0);
    });
  });
});
