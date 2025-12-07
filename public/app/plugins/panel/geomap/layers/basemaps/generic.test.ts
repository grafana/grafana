import OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { EventBus, GrafanaTheme2, MapLayerOptions } from '@grafana/data';

import { xyzTiles, XYZConfig } from './generic';

describe('XYZ tile layer', () => {
  let mockMap: OpenLayersMap;
  let mockEventBus: EventBus;
  let mockTheme: GrafanaTheme2;

  beforeEach(() => {
    mockMap = {} as OpenLayersMap;
    mockEventBus = {} as EventBus;
    mockTheme = {} as GrafanaTheme2;
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
});
