import { defaultMapViewConfig } from './panelcfg.gen';
import { centerPointRegistry, MapCenterID } from './view';

/** Preset map centers referenced by geomap docs (regional views + core view modes). */
const EXPECTED_GEOMAP_VIEW_IDS = [
  MapCenterID.Fit,
  MapCenterID.Zero,
  MapCenterID.Coordinates,
  'north-america',
  'south-america',
  'europe',
  'africa',
  'west-asia',
  's-asia',
  'se-asia',
  'e-asia',
  'australia',
  'oceania',
] as const;

describe('centerPointRegistry', () => {
  it('includes initial view options documented for geomap', () => {
    const ids = new Set(centerPointRegistry.list().map((item) => item.id));

    expect(EXPECTED_GEOMAP_VIEW_IDS.every((id) => ids.has(id))).toBe(true);
  });

  it('should expose lat, lon, and zoom for the Europe preset (initial view)', () => {
    const europe = centerPointRegistry.getIfExists('europe');
    expect(europe).toEqual(
      expect.objectContaining({
        id: 'europe',
        name: 'Europe',
        lat: 46,
        lon: 14,
        zoom: 4,
      })
    );
  });

  it('should set max zoom on fit-to-data registry item for layer max zoom when fitting', () => {
    const fit = centerPointRegistry.getIfExists(MapCenterID.Fit);
    expect(fit).toEqual(
      expect.objectContaining({
        id: MapCenterID.Fit,
        name: 'Fit to data',
        zoom: 15,
      })
    );
  });

  it('should expose origin coordinates for the (0°, 0°) preset', () => {
    const zero = centerPointRegistry.getIfExists(MapCenterID.Zero);
    expect(zero).toEqual(
      expect.objectContaining({
        id: MapCenterID.Zero,
        name: '(0°, 0°)',
        lat: 0,
        lon: 0,
      })
    );
  });
});

describe('defaultMapViewConfig', () => {
  it('should default new panels to (0°, 0°) at zoom 1 with fit-to-all-layers scope', () => {
    expect(defaultMapViewConfig).toEqual(
      expect.objectContaining({
        id: 'zero',
        lat: 0,
        lon: 0,
        zoom: 1,
        allLayers: true,
        noRepeat: false,
      })
    );
  });
});
