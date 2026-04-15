import { publicServiceRegistry } from './esri';

describe('ArcGIS MapServer (esri) public service registry', () => {
  it('should expose server instance ids documented for the ArcGIS basemap layer', () => {
    const ids = new Set(publicServiceRegistry.list().map((item) => item.id));

    expect(ids.has('streets')).toBe(true);
    expect(ids.has('world-imagery')).toBe(true);
    expect(ids.has('world-physical')).toBe(true);
    expect(ids.has('topo')).toBe(true);
    expect(ids.has('usa-topo')).toBe(true);
    expect(ids.has('ocean')).toBe(true);
    expect(ids.has('custom')).toBe(true);
  });
});
