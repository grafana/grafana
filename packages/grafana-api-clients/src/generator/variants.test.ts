import { variantFor, MARKERS, PACKAGE_ROOT } from './variants';

describe('variantFor', () => {
  it('returns the OSS variant for false', () => {
    const v = variantFor(false);
    expect(v.clientBase).toContain(PACKAGE_ROOT);
    expect(v.generateCommand).toBe('yarn generate-apis');
  });

  it('returns the enterprise variant for true', () => {
    const v = variantFor(true);
    expect(v.clientBase).toBe('public/app/extensions/api/clients');
    expect(v.generateCommand).toContain('rtk-query-codegen-openapi');
  });
});

describe('MARKERS', () => {
  it('exposes all required marker strings', () => {
    expect(MARKERS.CONFIG).toBeDefined();
    expect(MARKERS.IMPORT).toBeDefined();
    expect(MARKERS.REDUCER).toBeDefined();
    expect(MARKERS.MIDDLEWARE).toBeDefined();
  });
});

describe('PACKAGE_ROOT', () => {
  it('points to the api-clients package', () => {
    expect(PACKAGE_ROOT).toBe('packages/grafana-api-clients');
  });
});
