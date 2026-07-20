import { centerPointRegistry, MapCenterID } from './view';

describe('centerPointRegistry', () => {
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
