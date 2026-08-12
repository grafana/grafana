import { getLayersOptions } from './registry';

let mockHasAlphaPanels = false;

jest.mock('app/core/config', () => ({
  ...jest.requireActual('app/core/config'),
  get hasAlphaPanels() {
    return mockHasAlphaPanels;
  },
}));

// Use deterministic fake layer sets so the assertions test the selection logic itself
// (alpha gating, beta labelling, ordering) rather than the churn of real layer registrations.
// Mocking the barrels also avoids loading real data layers, which pull ol/source -> geotiff
// (untransformed ESM under jest).
jest.mock('./basemaps', () => ({
  basemapLayers: [{ id: 'base-a', name: 'Base A' }],
}));
jest.mock('./data', () => {
  const { PluginState } = jest.requireActual('@grafana/data');
  return {
    dataLayers: [
      { id: 'data-a', name: 'Data A' },
      { id: 'data-beta', name: 'Data Beta', state: PluginState.beta },
      { id: 'data-alpha', name: 'Data Alpha', state: PluginState.alpha },
    ],
  };
});

const ids = (opts: Array<{ value?: string }>) => opts.map((o) => o.value);

describe('getLayersOptions', () => {
  beforeEach(() => {
    mockHasAlphaPanels = false;
  });

  it('offers the default base layer plus basemaps for basemap selection, excluding data layers', () => {
    const { options } = getLayersOptions(true);
    expect(ids(options)).toEqual(['default', 'base-a']);
  });

  it('offers data layers plus basemaps for overlay selection', () => {
    const { options } = getLayersOptions(false);
    expect(ids(options)).toContain('data-a');
    expect(ids(options)).toContain('base-a');
  });

  it('labels beta layers and still includes them (switch falls through to default)', () => {
    const { options } = getLayersOptions(false);
    const beta = options.find((o) => o.value === 'data-beta');
    expect(beta!.label).toBe('Data Beta (Beta)');
  });

  it('reports the current selection separately', () => {
    const { current } = getLayersOptions(false, 'data-a');
    expect(ids(current)).toEqual(['data-a']);
  });

  describe('alpha layer gating', () => {
    it('hides alpha layers when alpha panels are disabled', () => {
      const { options } = getLayersOptions(false);
      expect(ids(options)).not.toContain('data-alpha');
      expect(options.some((o) => o.label?.includes('(Alpha)'))).toBe(false);
    });

    it('shows alpha layers labelled, bolt-iconed, and ordered last when alpha panels are enabled', () => {
      mockHasAlphaPanels = true;
      const { options } = getLayersOptions(false);

      const alpha = options.find((o) => o.value === 'data-alpha');
      expect(alpha!.label).toBe('Data Alpha (Alpha)');
      expect(alpha!.icon).toBe('bolt');
      // alpha layers are appended after the regular (non-alpha) layers
      expect(ids(options).indexOf('data-alpha')).toBeGreaterThan(ids(options).indexOf('data-a'));
    });
  });
});
