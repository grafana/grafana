import { defaultMapViewConfig, defaultOptions, MapCenterID, TooltipMode } from './panelcfg.gen';

describe('geomap panel configuration defaults', () => {
  it.each([
    { label: 'TooltipMode.None', value: TooltipMode.None, id: 'none' },
    { label: 'TooltipMode.Details', value: TooltipMode.Details, id: 'details' },
  ])('$label matches CUE string $id', ({ value, id }) => {
    expect(value).toBe(id);
  });

  it.each([
    { label: 'MapCenterID.Zero', value: MapCenterID.Zero, id: 'zero' },
    { label: 'MapCenterID.Coords', value: MapCenterID.Coords, id: 'coords' },
    { label: 'MapCenterID.Fit', value: MapCenterID.Fit, id: 'fit' },
  ])('$label matches CUE string $id', ({ value, id }) => {
    expect(value).toBe(id);
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
