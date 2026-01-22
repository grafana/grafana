import { detectImportModel } from './detect';

describe('import detect helpers', () => {
  it('detects v2 resource format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { elements: {} } };
    expect(detectImportModel(dashboard)).toBe('v2-resource');
  });

  it('detects v2 spec format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { elements: {} } };
    expect(detectImportModel(dashboard)).toBe('v2-resource');
  });

  it('detects v1 resource format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { title: 'v1' } };
    expect(detectImportModel(dashboard)).toBe('v1-resource');
  });

  it('detects classic format', () => {
    const dashboard = { title: 'v1' };
    expect(detectImportModel(dashboard)).toBe('classic');
  });
});
