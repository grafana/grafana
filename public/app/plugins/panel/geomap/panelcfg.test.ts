import { defaultMapViewConfig, defaultOptions, MapCenterID, TooltipMode } from './panelcfg.gen';

describe('geomap panel configuration defaults', () => {
  it('should define tooltip modes for map controls (none vs details)', () => {
    expect(TooltipMode.None).toBe('none');
    expect(TooltipMode.Details).toBe('details');
  });

  it('should define map center preset ids matching the CUE schema', () => {
    expect(MapCenterID.Zero).toBe('zero');
    expect(MapCenterID.Coords).toBe('coords');
    expect(MapCenterID.Fit).toBe('fit');
  });

  it('should start with no overlay data layers in generated default options', () => {
    expect(defaultOptions).toEqual({ layers: [] });
  });

  it('should match CUE defaults for generated default map view config', () => {
    expect(defaultMapViewConfig).toEqual({
      allLayers: true,
      id: 'zero',
      lat: 0,
      lon: 0,
      noRepeat: false,
      zoom: 1,
    });
  });
});
