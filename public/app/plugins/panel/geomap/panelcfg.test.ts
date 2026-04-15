import { defaultMapViewConfig, defaultOptions, TooltipMode } from './panelcfg.gen';

describe('geomap panel configuration defaults', () => {
  it('should define tooltip modes for map controls (none vs details)', () => {
    expect(TooltipMode.None).toBe('none');
    expect(TooltipMode.Details).toBe('details');
  });

  it('should start with no overlay data layers in generated default options', () => {
    expect(defaultOptions.layers).toEqual([]);
  });

  it('should align default map view id with registry zero preset', () => {
    expect(defaultMapViewConfig.id).toBe('zero');
    expect(defaultMapViewConfig.lat).toBe(0);
    expect(defaultMapViewConfig.lon).toBe(0);
  });
});
